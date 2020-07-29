import cuid from 'cuid';
import util from 'apostrophe/lib/shared-util';

const virtualDocs = {};

export default {
  // Returns an _id for a virtual doc which is initially a clone of the permanent
  // properties of `existing` if provided, otherwise an empty object. Used to
  // edit areas in context via patch operations even though the real doc is either
  // not in the database yet, or not expected to be modified until a save button
  // is clicked.
  createVirtualDoc(existing) {
    const _id = `$${cuid}`;
    virtualDocs[_id] = existing ? util.clonePermanent(existing) : {};
    return _id;
  },
  // Removes a virtual doc from memory when no longer in use.
  destroyVirtualDoc(_id) {
    delete virtualDocs[_id];
  },
  // Fetch a virtual doc by its _id. Typically then merged into a new
  // or updated database doc.
  getVirtualDoc(_id) {
    return virtualDocs[_id];
  },
  // Can accept either a database _id or a virtual doc _id (distinguished
  // by the leading $, which is automatically supplied) and will
  // carry out the patch with the same semantics
  async patch(_id, options) {
    if (_id.substring(0, 1) !== '$') {
      return apos.http.patch(`${apos.doc.action}/${_id}`, options);
    }
    const doc = virtualDocs[_id];
    util.applyPatchOperators(options.body, doc);
  }
};
