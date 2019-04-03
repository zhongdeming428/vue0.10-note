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
 */
function extend (options) {

    var ParentVM = this

    // extend data options need to be copied
    // on instantiation
    if (options.data) {
        options.defaultData = options.data
        delete options.data
    }

    // inherit options
    // but only when the super class is not the native Vue.
    if (ParentVM !== ViewModel) {
        options = inheritOptions(options, ParentVM.options, true)
    }
    utils.processOptions(options)

    var ExtendedVM = function (opts, asParent) {
        if (!asParent) {
            opts = inheritOptions(opts, options, true)
        }
        ParentVM.call(this, opts, true)
    }

    // inherit prototype props
    var proto = ExtendedVM.prototype = Object.create(ParentVM.prototype)
    utils.defProtected(proto, 'constructor', ExtendedVM)

    // allow extended VM to be further extended
    ExtendedVM.extend  = extend
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
 *  Inherit options
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
        if (key === 'el') continue
        var val = child[key],
            parentVal = parent[key]
        if (topLevel && typeof val === 'function' && parentVal) {
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
            // merge toplevel object options
            child[key] = inheritOptions(val, parentVal)
        } else if (val === undefined) {
            // inherit if child doesn't override
            child[key] = parentVal
        }
    }
    return child
}

module.exports = ViewModel