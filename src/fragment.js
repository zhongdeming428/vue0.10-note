/**
 * 根据字符串生成 DocumentFragment 元素。
 * 代码来源于 https://github.com/component/domify
 */

// string -> DOM conversion
// wrappers originally from jQuery, scooped from component/domify
var map = {
    legend   : [1, '<fieldset>', '</fieldset>'],
    tr       : [2, '<table><tbody>', '</tbody></table>'],
    col      : [2, '<table><tbody></tbody><colgroup>', '</colgroup></table>'],
    _default : [0, '', '']
}

map.td =
map.th = [3, '<table><tbody><tr>', '</tr></tbody></table>']

map.option =
map.optgroup = [1, '<select multiple="multiple">', '</select>']

map.thead =
map.tbody =
map.colgroup =
map.caption =
map.tfoot = [1, '<table>', '</table>']

map.text =
map.circle =
map.ellipse =
map.line =
map.path =
map.polygon =
map.polyline =
map.rect = [1, '<svg xmlns="http://www.w3.org/2000/svg" version="1.1">','</svg>']

var TAG_RE = /<([\w:]+)/

module.exports = function (templateString) {
    var frag = document.createDocumentFragment(),
        m = TAG_RE.exec(templateString)
    // text only
    if (!m) {
        // templateString 是纯文本（不包含 html 标签）时，创建一个 text 节点并返回。
        frag.appendChild(document.createTextNode(templateString))
        return frag
    }

    var tag = m[1],
        wrap = map[tag] || map._default,
        depth = wrap[0], // 包裹层级
        prefix = wrap[1], // 前置
        suffix = wrap[2], // 后置
        node = document.createElement('div')

    node.innerHTML = prefix + templateString.trim() + suffix
    // 剥离出由 templateString 构造的最原始的 DOM。
    while (depth--) node = node.lastChild

    // one element
    if (node.firstChild === node.lastChild) {
        // node 只有一个子元素的时候（templateString 只有一个根标签），直接追加到 frag。
        frag.appendChild(node.firstChild)
        return frag
    }

    // multiple nodes, return a fragment
    var child
    /* jshint boss: true */
    while (child = node.firstChild) {
        // 如果有多个根元素，依次附加到 frag。
        frag.appendChild(child)
    }
    return frag
}