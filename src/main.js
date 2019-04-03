/**
 * 当前文件主要用于在 Vue 函数上绑定一系列属性，
 * 比如 component、partial、directive、nextTick 等等……
 */

var config      = require('./config'),
    ViewModel   = require('./viewmodel'),
    utils       = require('./utils'),
    makeHash    = utils.hash,
    assetTypes  = ['directive', 'filter', 'partial', 'effect', 'component'],
    // Internal modules that are exposed for plugins
    pluginAPI   = {
        utils: utils,
        config: config,
        transition: require('./transition'),
        observer: require('./observer')
    }

ViewModel.options = config.globalAssets = {
    directives  : require('./directives'),
    filters     : require('./filters'),
    partials    : makeHash(),
    effects     : makeHash(),
    components  : makeHash()
}

/**
 *  Expose asset registration methods
 *  暴露各个属性的注册方法，比如 component、partial、directive...
 *  针对 assetTypes 里面的每个属性，在 ViewModel 上挂载一个对应的注册方法，
 *  即 Vue.component、Vue.directive...
 */
assetTypes.forEach(function (type) {
    // 注册方法，该方法接受一个 id（实际上是名称）和一个值。
    ViewModel[type] = function (id, value) {
        var hash = this.options[type + 's'] // Vue.options.components...
        if (!hash) {
            // 如果不存在 Vue.options.components 这种属性，新建一个...
            hash = this.options[type + 's'] = makeHash()
        }
        if (!value) return hash[id]
        // 针对不同属性，处理传入的 value。
        if (type === 'partial') {
            // partial 在 Vue 2.0 中已废弃。
            value = utils.parseTemplateOption(value)
        } else if (type === 'component') {
            value = utils.toConstructor(value)
        } else if (type === 'filter') {
            utils.checkFilter(value)
        }
        // 注册的结果就是挂载到 Vue.options。
        hash[id] = value
        return this
    }
})

/**
 *  Set config options
 *  用于获取和设置全局配置对象的方法。0.11 开始，Vue.config 变成了一个全局配置对象。
 */
ViewModel.config = function (opts, val) {
    if (typeof opts === 'string') {
        if (val === undefined) {
            return config[opts]
        } else {
            config[opts] = val
        }
    } else {
        utils.extend(config, opts)
    }
    return this
}

/**
 *  Expose an interface for plugins
 *  注册 Vue 插件的方法。
 */
ViewModel.use = function (plugin) {
    // 如果是字符串，则 require。
    if (typeof plugin === 'string') {
        try {
            plugin = require(plugin)
        } catch (e) {
            utils.warn('Cannot find plugin: ' + plugin)
            return
        }
    }

    // additional parameters
    // 提取 use 方法的多余参数，稍后传入 plugin.install。
    var args = [].slice.call(arguments, 1)
    // 在数组头部插入当前实例。
    args.unshift(this)

    if (typeof plugin.install === 'function') {
        // 如果 plugin.install 是一个函数，那么执行。
        plugin.install.apply(plugin, args)
    } else {
        // 否则直接执行 plugin。
        plugin.apply(null, args)
    }
    return this
}

/**
 *  Expose internal modules for plugins
 *  获取内部 plugin 的方法。
 */
ViewModel.require = function (module) {
    return pluginAPI[module]
}

ViewModel.extend = extend
ViewModel.nextTick = utils.nextTick

/**
 *  Expose the main ViewModel class
 *  and add extend method
 *  https://cn.vuejs.org/v2/api/#Vue-extend
 *  接受一些 Vue 构造参数，返回一个 Vue 子类，该子类可以接受新的 Vue 参数从而构造 Vue 实例。
 *  options 是用于构造父类的参数，这些参数会被子类继承。
 */
function extend (options) {

    // 第一次时指向 ViewModel，如果子类仍然被 extend，那么 this 指向子类。
    var ParentVM = this

    // extend data options need to be copied
    // on instantiation
    if (options.data) {
        // 把 data 挂载到 defaultData，后面应该还会处理。
        options.defaultData = options.data
        delete options.data
    }

    // inherit options
    // but only when the super class is not the native Vue.
    // 当 this 不指向 ViewModel 的时候，继承 options。
    // this 可能来自 ViewModel 的“子类”，子类仍然可以被继承。
    if (ParentVM !== ViewModel) {
        options = inheritOptions(options, ParentVM.options, true)
    }
    // 对 options 的一些属性进行预处理。
    utils.processOptions(options)

    // 构造子类的构造函数。
    var ExtendedVM = function (opts, asParent) {
        // 由 asParent 决定是否把预设 options 加入到构造函数中。
        // 如果 asParent 为 true，那么直接构造一个 Vue 实例，不把预设参数加入；
        // 如果 asParent 为 false，那么先 merge 预设参数，然后再构造 Vue 实例，造成 Vue “继承”。
        if (!asParent) {
            // inheritOptions 决定 options merge 的方式。
            opts = inheritOptions(opts, options, true)
        }
        // 当 ParentVM === ViewModel 时，true 是多余参数。
        // 当 ParentVM !== ViewModel 时，true 被作为 asParent 的值传入当前函数。
        // 这里绑定 this 的指向还有疑问，因为 ViewModel 没有显式调用 this 啊……
        ParentVM.call(this, opts, true)
    }

    // inherit prototype props
    // 原型也要继承~
    var proto = ExtendedVM.prototype = Object.create(ParentVM.prototype)
    // 原型被赋值以后，需要重新指定原型上的 constructor 属性。
    utils.defProtected(proto, 'constructor', ExtendedVM)

    // allow extended VM to be further extended
    ExtendedVM.extend  = extend // 允许构造出来的“子类”仍然可以被“继承”。
    ExtendedVM.super   = ParentVM
    ExtendedVM.options = options

    // allow extended VM to add its own assets
    assetTypes.forEach(function (type) {
        ExtendedVM[type] = ViewModel[type]
    })

    // allow extended VM to use plugins
    ExtendedVM.use     = ViewModel.use
    ExtendedVM.require = ViewModel.require

    return ExtendedVM
}

/**
 *  Inherit options，用于 merge options 的方法。
 *
 *  For options such as `data`, `vms`, `directives`, 'partials',
 *  they should be further extended. However extending should only
 *  be done at top level.
 *  
 *  `proto` is an exception because it's handled directly on the
 *  prototype.
 *
 *  `el` is an exception because it's not allowed as an
 *  extension option, but only as an instance option.
 */
function inheritOptions (child, parent, topLevel) {
    child = child || {}
    if (!parent) return child
    for (var key in parent) {
        // 遍历 parent 的 options 的所有属性，准备 merge 到 child 的 options 上。
        if (key === 'el') continue // 跳过 el 属性。
        var val = child[key], // 子类当前配置项的值。
            parentVal = parent[key] // 父类当前配置项的值。
        if (topLevel && typeof val === 'function' && parentVal) {
            // 如果是钩子函数，放到数组队列里面，以后依次调用。
            // merge hook functions into an array
            child[key] = [val]
            if (Array.isArray(parentVal)) {
                child[key] = child[key].concat(parentVal)
            } else {
                child[key].push(parentVal)
            }
        } else if (
            topLevel &&
            (utils.isTrueObject(val) || utils.isTrueObject(parentVal))
            && !(parentVal instanceof ViewModel)
        ) {
            // 合并顶层的纯对象属性。
            // merge toplevel object options
            child[key] = inheritOptions(val, parentVal)
        } else if (val === undefined) {
            // inherit if child doesn't override
            // 如果子类配置项不存在，那么直接赋值。
            child[key] = parentVal
        }
    }
    return child
}

module.exports = ViewModel