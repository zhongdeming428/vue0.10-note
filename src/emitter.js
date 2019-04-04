/**
 * 该文件定义了一个事件的发布订阅中心，供其他模块使用。
 */

var slice = [].slice

function Emitter (ctx) {
    this._ctx = ctx || this
}

var EmitterProto = Emitter.prototype

// 注册事件及回调。
EmitterProto.on = function (event, fn) {
    this._cbs = this._cbs || {}
    ;(this._cbs[event] = this._cbs[event] || [])
        .push(fn)
    return this
}

// 注册一个事件，其回调只会被执行一次。
EmitterProto.once = function (event, fn) {
    var self = this
    this._cbs = this._cbs || {}

    // 重新定义事件回调，稍后注册。
    function on () {
        // 在调用之前，先注销掉这个事件回调，确保只会被执行一次。
        self.off(event, on)
        fn.apply(this, arguments)
    }

    // 在 on 上面挂载 fn 属性，为了后面的注销函数使用。
    on.fn = fn
    // 通过 on 注册事件回调。
    this.on(event, on)
    return this
}

// 事件回调的注销函数。
EmitterProto.off = function (event, fn) {
    this._cbs = this._cbs || {}

    // all
    if (!arguments.length) {
        this._cbs = {}
        return this
    }

    // specific event
    var callbacks = this._cbs[event]
    if (!callbacks) return this

    // remove all handlers
    // 如果只传递了第一个参数（事件名称），那么注销该事件的所有回调。
    if (arguments.length === 1) {
        delete this._cbs[event]
        return this
    }

    // remove specific handler
    var cb
    // 注销 fn。
    for (var i = 0; i < callbacks.length; i++) {
        cb = callbacks[i]
        // cb.fn 是 once 函数注册的事件回调。
        if (cb === fn || cb.fn === fn) {
            callbacks.splice(i, 1)
            break
        }
    }
    return this
}

/**
 *  The internal, faster emit with fixed amount of arguments
 *  using Function.call
 *  事件发射函数，触发事件的所有回调，通过固定参数个数和使用 Function.call 来提高速度。
 */
EmitterProto.emit = function (event, a, b, c) {
    this._cbs = this._cbs || {}
    var callbacks = this._cbs[event]

    if (callbacks) {
        callbacks = callbacks.slice(0)
        for (var i = 0, len = callbacks.length; i < len; i++) {
            callbacks[i].call(this._ctx, a, b, c)
        }
    }

    return this
}

/**
 *  The external emit using Function.apply
 *  通过 apply 调用回调。
 */
EmitterProto.applyEmit = function (event) {
    this._cbs = this._cbs || {}
    var callbacks = this._cbs[event], args

    if (callbacks) {
        callbacks = callbacks.slice(0)
        args = slice.call(arguments, 1)
        for (var i = 0, len = callbacks.length; i < len; i++) {
            callbacks[i].apply(this._ctx, args)
        }
    }

    return this
}

module.exports = Emitter