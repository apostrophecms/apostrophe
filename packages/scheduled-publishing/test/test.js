const assert = require('assert');
const t = require('apostrophe/test-lib/util');

describe('Apostrophe Scheduled Publishing', function() {
  let apos;

  this.timeout(t.timeout);

  before(async function () {
    apos = await t.create({
      root: module,
      baseUrl: 'http://localhost:7780',
      modules: getAppModules()
    });
  });

  after(function() {
    return t.destroy(apos);
  });

  afterEach(function() {
    apos.doc.db.deleteMany({
      title: {
        $in: [ 'topic 1', 'parent page', 'child page' ]
      }
    });
  });

  it('should have instantiated properly the scheduled publishing module and have update task', function() {
    assert(apos.scheduledPub);
    assert(apos.scheduledPub.tasks.update);
  });

  it('should publish a doc when scheduled in the past', async function () {
    const { draftReq, req } = getReqs(apos);

    await insertDraftDoc(
      apos,
      draftReq,
      { scheduledPublish: getDate() }
    );

    const unpublishedTopic = await apos.topic.find(draftReq, {
      title: 'topic 1',
      aposMode: 'published'
    }).toObject();

    assert(!unpublishedTopic);

    await apos.task.invoke('@apostrophecms/scheduled-publishing:update');

    const publishedTopic = await apos.topic.find(req, {
      title: 'topic 1',
      aposMode: 'published'
    }).toObject();

    assert(publishedTopic);
  });

  it('should update a doc if scheduled in the past', async function () {
    const { draftReq, req } = getReqs(apos);

    const draftDoc = await insertDraftDoc(apos, draftReq);

    await publishDoc(apos, draftDoc);

    const docToUpdate = {
      ...draftDoc,
      title: 'topic 1 updated',
      scheduledPublish: getDate()
    };

    const draftUpdated = await apos.topic.update(draftReq, docToUpdate);

    assert(draftUpdated);
    assert(draftUpdated.title === 'topic 1 updated');

    await apos.task.invoke('@apostrophecms/scheduled-publishing:update');

    const updatedPublished = await apos.topic.find(req, {
      aposDocId: draftDoc.aposDocId,
      aposMode: 'published'
    }).toObject();

    assert(updatedPublished);
    assert(updatedPublished.title === 'topic 1 updated');
  });

  it('should not publish a doc when scheduled in the future', async function () {
    const { draftReq, req } = getReqs(apos);

    await insertDraftDoc(apos, draftReq, {
      scheduledPublish: getDate(true)
    });

    await apos.task.invoke('@apostrophecms/scheduled-publishing:update');

    const publishedTopic = await apos.topic.find(req, {
      title: 'topic 1',
      aposMode: 'published'
    }).toObject();

    assert(!publishedTopic);
  });

  it('should set a publishing date in the future and not update it when running the task', async function () {
    const { draftReq, req } = getReqs(apos);

    const draftDoc = await insertDraftDoc(apos, draftReq);

    await apos.doc.publish(draftReq, draftDoc);

    const publishedDoc = await apos.topic.find(req, {
      title: 'topic 1',
      aposMode: 'published'
    }).toObject();

    assert(publishedDoc);

    const docToUpdate = {
      ...draftDoc,
      title: 'topic 1 updated',
      scheduledPublish: getDate(true)
    };

    const draftUpdated = await apos.topic.update(draftReq, docToUpdate);

    assert(draftUpdated);
    assert(draftUpdated.title === 'topic 1 updated');

    await apos.task.invoke('@apostrophecms/scheduled-publishing:update');

    const updatedPublished = await apos.topic.find(req, {
      aposDocId: draftDoc.aposDocId,
      aposMode: 'published'
    }).toObject();

    assert(updatedPublished);
    assert(updatedPublished.title === 'topic 1');
  });

  it('should unpublish document if scheduled in the past', async function() {
    const { draftReq, req } = getReqs(apos);

    const draftDoc = await insertDraftDoc(apos, draftReq, {
      scheduledUnpublish: getDate()
    });

    const publishedDoc = await publishDoc(apos, draftDoc);

    await apos.task.invoke('@apostrophecms/scheduled-publishing:update');

    const unpublishedDoc = await apos.topic.find(req, {
      _id: publishedDoc._id
    }).toObject();

    assert(!unpublishedDoc);
  });

  it('should not unpublish a doc if scheduled in the future', async function() {
    const { draftReq, req } = getReqs(apos);

    const draftDoc = await insertDraftDoc(apos, draftReq, {
      scheduledUnpublish: getDate(true)
    });

    const publishedDoc = await publishDoc(apos, draftDoc);

    await apos.task.invoke('@apostrophecms/scheduled-publishing:update');

    const stillPublishedDoc = await apos.topic.find(req, {
      _id: publishedDoc._id
    }).toObject();

    assert(stillPublishedDoc);
  });

  it('should publish pages if scheduled in the past', async function() {
    const { draftReq } = getReqs(apos);
    const draftPages = await getPages(apos);

    for (const draftPage of draftPages) {
      await apos.page.insert(
        draftReq,
        draftPage.target,
        'lastChild',
        {
          ...draftPage.body,
          scheduledPublish: getDate()
        }
      );
    }

    const pages = await apos.page.find(draftReq).toArray();

    assert(pages.length === 3);

    await apos.task.invoke('@apostrophecms/scheduled-publishing:update');

    const publishedPages = await getPublishedPages(apos);

    assert(publishedPages.length === 2);
  });

  it('should unpublish pages in the right order if scheduled in the past', async function() {
    const { draftReq, req } = getReqs(apos);
    const draftPages = await getPages(apos);
    const livePages = await getPages(apos, 'published');

    for (const draftPage of draftPages) {
      await apos.page.insert(
        draftReq,
        draftPage.target,
        'lastChild',
        {
          ...draftPage.body,
          scheduledUnpublish: getDate()
        }
      );
    }

    for (const livePage of livePages) {
      await apos.page.insert(
        req,
        livePage.target,
        'lastChild',
        livePage.body
      );
    }

    const publishedPages = await getPublishedPages(apos);

    assert(publishedPages.length === 2);

    await apos.task.invoke('@apostrophecms/scheduled-publishing:update');

    const unpublishedPages = await getPublishedPages(apos);

    assert(!unpublishedPages.length);
  });
});

function getPublishedPages(apos) {
  const { req } = getReqs(apos);

  return apos.page.find(req, {
    aposDocId: {
      $in: [ 'parent', 'child' ]
    },
    aposMode: 'published'
  }).toArray();
}

function getDate(future = false) {
  const date = new Date();

  if (!future) {
    return date.toISOString();
  }

  date.setHours(date.getHours() + 1);

  return date.toISOString();
}

async function insertDraftDoc(apos, draftReq, doc = {}) {
  const topic = {
    ...apos.topic.newInstance(),
    title: 'topic 1',
    ...doc
  };

  const draftDoc = await apos.topic.insert(draftReq, topic);

  assert(draftDoc);
  assert(draftDoc.title === 'topic 1');
  assert(draftDoc.aposMode === 'draft');

  return draftDoc;
}

async function publishDoc(apos, draftDoc) {
  const { req, draftReq } = getReqs(apos);
  await apos.doc.publish(draftReq, draftDoc);

  const publishedDoc = await apos.topic.find(req, {
    title: 'topic 1',
    aposMode: 'published'
  }).toObject();

  assert(publishedDoc);

  return publishedDoc;
}

function getReqs(apos) {
  return {
    draftReq: apos.task.getReq({
      mode: 'draft'
    }),
    req: apos.task.getReq()
  };
}

function getAppModules() {
  return {
    '@apostrophecms/express': {
      options: {
        port: 7780,
        session: { secret: 'supersecret' }
      }
    },
    '@apostrophecms/scheduled-publishing': {
      options: {
        alias: 'scheduledPub'
      }
    },
    'default-page': {
      extend: '@apostrophecms/page-type'
    },
    topic: {
      extend: '@apostrophecms/piece-type',
      options: {
        alias: 'topic'
      }
    }
  };
}

async function getPages(apos, draftOrLive = 'draft') {
  const { draftReq, req } = getReqs(apos);
  const { _id: homeId } = await apos.page.find(
    draftOrLive === 'draft' ? draftReq : req,
    { level: 0 }
  ).toObject();

  return [
    {
      target: homeId,
      body: {
        _id: `parent:en:${draftOrLive}`,
        title: 'parent page',
        aposLocale: `en:${draftOrLive}`,
        aposDocId: 'parent',
        type: 'default-page',
        slug: '/parent',
        visibility: 'public',
        aposMode: draftOrLive,
        level: 1,
        rank: 0
      }
    },
    {
      target: `parent:en:${draftOrLive}`,
      body: {
        _id: `child:en:${draftOrLive}`,
        title: 'child page',
        aposLocale: `en:${draftOrLive}`,
        aposDocId: 'child',
        type: 'default-page',
        slug: '/parent/child',
        visibility: 'public',
        aposMode: draftOrLive,
        level: 2,
        rank: 0
      }
    }
  ];
}
