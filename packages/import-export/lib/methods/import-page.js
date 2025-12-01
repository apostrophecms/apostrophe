const getTargetId = async ({
  manager,
  doc,
  req,
  duplicatedDocs = []
}) => {
  if (doc.archived) {
    return '_archive';
  }

  const duplicatedDocsMapping = Object.fromEntries(
    duplicatedDocs.map(duplicate => [ duplicate.aposDocId, duplicate.replaceId ])
  );

  const { path = '' } = doc;
  const ancestorIds = path.split('/').reverse().slice(1);
  for (const ancestorId of ancestorIds) {
    try {
      const { aposDocId } = await manager.getTarget(
        req,
        duplicatedDocsMapping[ancestorId] || ancestorId
      );
      return aposDocId;
    } catch (error) {
      // continue search
    }
  }

  // If no target is found, try by slug. Remove the last segment of the path
  // and search for the slug in the database.
  const parentSlug = doc.slug?.split('/').slice(0, -1).join('/');
  const aposDocId = await getTargetIdBySlug(
    req,
    {
      manager,
      slug: parentSlug,
      mode: doc.aposMode
    }
  );
  if (aposDocId) {
    return aposDocId;
  }

  return '_home';
};

async function getTargetIdBySlug(req, {
  manager,
  slug,
  mode
}) {
  if (!slug || slug === '/') {
    return null;
  }

  const criteria = {
    slug,
    aposLocale: `${req.locale}:${mode}`
  };
  const target = await manager.find(req, criteria)
    .project({
      _id: 1,
      aposDocId: 1
    })
    .permission(false)
    .archived(null)
    .areas(false)
    .toObject();

  if (!target) {
    return null;
  }

  try {
    const { aposDocId } = await manager.getTarget(
      req,
      target.aposDocId
    );
    return aposDocId;
  } catch (error) {
    // ignore
  }

  return null;
}

const insert = async ({
  manager,
  doc,
  req,
  duplicatedDocs,
  modified
}) => {
  const targetId = await getTargetId({
    manager,
    doc,
    req,
    duplicatedDocs
  });
  const position = 'lastChild';

  return manager.insert(
    req,
    targetId,
    position,
    doc,
    { setModified: modified }
  );
};

const update = async ({
  manager,
  doc,
  req,
  duplicatedDocs
}) => {

  const {
    _id,
    aposDocId,
    path,
    rank,
    level,
    ...patch
  } = doc;

  const move = doc.parkedId
    ? {}
    : {
      _targetId: await getTargetId({
        manager,
        doc,
        req,
        duplicatedDocs
      }),
      _position: 'lastChild'
    };

  return manager.patch(
    req.clone({
      body: {
        ...patch,
        ...move
      }
    }),
    _id,
    {
      fetchRelationships: false
    }
  );
};

module.exports = {
  insert,
  update
};
