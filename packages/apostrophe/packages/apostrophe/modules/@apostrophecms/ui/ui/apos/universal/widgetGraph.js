import DirectedGraph from './graph.js';

/**
 * @typedef {Object} NodeMeta
 * @property {string}  type    – widget type name (e.g. '@apostrophecms/rich-text')
 * @property {string}  areaId  – the _id of the area that contains this widget
 * @property {boolean} [foreign] – true when the widget belongs to a different
 *                                  document than the graph owner (optional, low priority)
 */
export default class WidgetGraph extends DirectedGraph { }
