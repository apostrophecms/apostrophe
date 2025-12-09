const assert = require('assert');
const testUtil = require('apostrophe/test-lib/test');

describe('Anchors Wrapper', function () {
  let apos;

  this.timeout(10000);

  after(async function () {
    testUtil.destroy(apos);
  });

  it('should improve widget, area, and rte modules on the apos object', async function () {
    apos = await testUtil.create({
      shortname: 'test-exporter',
      testModule: true,
      modules: {
        '@apostrophecms/express': {
          options: {
            // trustProxy: true,
            session: { secret: 'test-the-anchors' }
          }
        },
        '@apostrophecms/anchors': {},
        '@apostrophecms/anchors-widget-type': {
          options: {
            // A meaningless option to confirm the piece types are "improved."
            anchorsActive: true
          }
        },
        '@apostrophecms/anchors-rich-text-widget': {
          options: {
            // A meaningless option to confirm the piece types are "improved."
            anchorsActive: true
          }
        },
        '@apostrophecms/image-widget': {
          options: {
            anchorAttribute: 'data-anchor'
          }
        }
      }
    });

    assert(apos.modules['@apostrophecms/video-widget'].options.anchorsActive === true);
    assert(apos.modules['@apostrophecms/rich-text-widget'].options.anchors === false);
  });

  it('will wrap a video widget', async () => {
    const videoManager = apos.modules['@apostrophecms/video-widget'];
    const req = apos.task.getReq();

    const output = await videoManager.output(req, {
      anchorId: 'test-one'
    }, {});

    assert(output.indexOf('div id=test-one') > -1);
  });

  it('will wrap an image widget with a custom data attribute', async () => {
    const imageManager = apos.modules['@apostrophecms/image-widget'];
    const req = apos.task.getReq();

    const output = await imageManager.output(req, {
      anchorId: 'test-two'
    }, {});

    assert(output.indexOf('div data-anchor=test-two') > -1);
  });

  it('will not wrap a rich text widget', async () => {
    const rteManager = apos.modules['@apostrophecms/rich-text-widget'];
    const req = apos.task.getReq();

    const output = await rteManager.output(req, {
      anchorId: 'test-three'
    }, {});

    assert(output.indexOf('test-three') === -1);
  });
});
