/**
 * 返回一个生成 DocumentFragment 实例的工厂方法。
 */

var toFragment = require('./fragment');

/**
 * Parses a template string or node and normalizes it into a
 * a node that can be used as a partial of a template option
 *
 * Possible values include
 * id selector: '#some-template-id'
 * template string: '<div><span>my template</span></div>'
 * DocumentFragment object
 * Node object of type Template
 */
module.exports = function(template) {
    var templateNode;

    // https://developer.mozilla.org/zh-CN/docs/Web/API/DocumentFragment
    if (template instanceof window.DocumentFragment) {
        // 如果 template 已经是一个 DocumentFragment 实例，则不做任何处理。
        // if the template is already a document fragment -- do nothing
        return template
    }

    if (typeof template === 'string') {
        // 如果 template 是一个字符串。
        // template by ID
        if (template.charAt(0) === '#') {
            // 如果 template 是一个 id 字符串。
            templateNode = document.getElementById(template.slice(1))
            if (!templateNode) return
        } else {
            return toFragment(template)
        }
    } else if (template.nodeType) {
        // https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeType
        templateNode = template
    } else {
        return
    }

    // if its a template tag and the browser supports it,
    // its content is already a document fragment!
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template
    // 如果 template 是一个 template 元素，那么代表浏览器支持 template 元素，其内部的元素即为 DocumentFragment 实例。
    if (templateNode.tagName === 'TEMPLATE' && templateNode.content) {
        return templateNode.content
    }

    if (templateNode.tagName === 'SCRIPT') {
        return toFragment(templateNode.innerHTML)
    }

    return toFragment(templateNode.outerHTML);
}
