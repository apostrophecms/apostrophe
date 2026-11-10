const assert = require('node:assert/strict');

const getLib = async () => import(
  '../modules/@apostrophecms/modal/ui/apos/lib/window-trigger.mjs'
);

const bounds = {
  width: 1000,
  height: 800
};
const still = {
  x: 0,
  y: 0
};

describe('Window trigger', function () {

  describe('parseCorner', function () {
    it('reads a stored corner', async function () {
      const { parseCorner } = await getLib();
      assert.deepEqual(parseCorner('{"x":"left","y":"top"}'), {
        x: 'left',
        y: 'top'
      });
    });

    it('falls back to bottom right for nothing, junk and unknown sides', async function () {
      const { parseCorner } = await getLib();
      const fallback = {
        x: 'right',
        y: 'bottom'
      };
      assert.deepEqual(parseCorner(null), fallback);
      assert.deepEqual(parseCorner('{not json'), fallback);
      assert.deepEqual(parseCorner('{"x":"middle","y":"top"}'), fallback);
    });
  });

  describe('getCornerFromName', function () {
    it('reads a corner name, else bottom right', async function () {
      const { getCornerFromName, parseCorner } = await getLib();
      assert.deepEqual(getCornerFromName('top-left'), {
        x: 'left',
        y: 'top'
      });
      assert.deepEqual(getCornerFromName('middle'), {
        x: 'right',
        y: 'bottom'
      });
      assert.deepEqual(parseCorner(null, getCornerFromName('bottom-left')), {
        x: 'left',
        y: 'bottom'
      });
    });
  });

  describe('isPointerNear', function () {
    const corner = {
      x: 'right',
      y: 'bottom'
    };
    const at = (fromRight, fromBottom) => ({
      x: bounds.width - fromRight,
      y: bounds.height - fromBottom
    });

    it('is near within the corner\'s reach', async function () {
      const { isPointerNear } = await getLib();
      const page = {
        overModal: false,
        overTrigger: false
      };
      assert.equal(isPointerNear(at(60, 60), corner, bounds, page), true);
      assert.equal(isPointerNear(at(200, 60), corner, bounds, page), false);
      assert.equal(isPointerNear(at(60, 60), {
        x: 'left',
        y: 'top'
      }, bounds, page), false);
    });

    it('is near over a modal\'s box only on the trigger itself', async function () {
      const { isPointerNear } = await getLib();
      assert.equal(isPointerNear(at(40, 40), corner, bounds, {
        overModal: true,
        overTrigger: false
      }), false);
      // Its disc at rest, or all of it once raised over the modal
      assert.equal(isPointerNear(at(40, 40), corner, bounds, {
        overModal: true,
        overTrigger: true
      }), true);
      assert.equal(isPointerNear(at(200, 40), corner, bounds, {
        overModal: true,
        overTrigger: true
      }), false);
    });
  });

  describe('getNearestCorner', function () {
    it('snaps a released trigger to the corner of its quarter', async function () {
      const { getNearestCorner } = await getLib();
      assert.deepEqual(getNearestCorner({
        x: 100,
        y: 100
      }, still, bounds), {
        x: 'left',
        y: 'top'
      });
      assert.deepEqual(getNearestCorner({
        x: 900,
        y: 700
      }, still, bounds), {
        x: 'right',
        y: 'bottom'
      });
      assert.deepEqual(getNearestCorner({
        x: 400,
        y: 700
      }, still, bounds), {
        x: 'left',
        y: 'bottom'
      });
    });

    it('carries a throw to the corner it was heading for', async function () {
      const { getNearestCorner } = await getLib();
      assert.deepEqual(getNearestCorner({
        x: 400,
        y: 700
      }, {
        x: 2,
        y: -2
      }, bounds), {
        x: 'right',
        y: 'top'
      });
    });

    it('ignores a slow drift', async function () {
      const { getNearestCorner } = await getLib();
      assert.deepEqual(getNearestCorner({
        x: 400,
        y: 700
      }, {
        x: 0.3,
        y: -0.3
      }, bounds), {
        x: 'left',
        y: 'bottom'
      });
    });
  });

  describe('getVelocity', function () {
    it('measures over the last 80ms of moves', async function () {
      const { getVelocity } = await getLib();
      const samples = [
        {
          x: 0,
          y: 0,
          t: 0
        },
        {
          x: 100,
          y: 0,
          t: 100
        },
        {
          x: 120,
          y: 10,
          t: 150
        }
      ];
      assert.deepEqual(getVelocity(samples, {
        x: 140,
        y: 20,
        t: 200
      }), {
        x: 0.4,
        y: 0.2
      });
    });

    it('is still without recent moves', async function () {
      const { getVelocity } = await getLib();
      assert.deepEqual(getVelocity([ {
        x: 0,
        y: 0,
        t: 0
      } ], {
        x: 50,
        y: 50,
        t: 500
      }), still);
    });
  });

  describe('getRestOffset', function () {
    it('points the offset away from the center in every corner', async function () {
      const { getRestOffset, OFFSETS } = await getLib();
      assert.deepEqual(getRestOffset({
        x: 'right',
        y: 'bottom'
      }, OFFSETS.tucked), {
        x: 14,
        y: 26
      });
      assert.deepEqual(getRestOffset({
        x: 'left',
        y: 'top'
      }, OFFSETS.tucked), {
        x: -14,
        y: -26
      });
    });
  });

  describe('stepSpring', function () {
    it('settles on its target', async function () {
      const { stepSpring, isSettled } = await getLib();
      const target = {
        x: 14,
        y: 26
      };
      let position = {
        x: -300,
        y: -400
      };
      let velocity = { ...still };
      let frames = 0;
      while (!isSettled(position, velocity, target) && frames < 300) {
        ({ position, velocity } = stepSpring(position, velocity, target, 1 / 60));
        frames++;
      }
      assert(isSettled(position, velocity, target));
      assert(frames < 120, `settled in ${frames} frames`);
    });
  });
});
