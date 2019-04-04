/**
 * 该文件用于定义一个 batcher（批处理器），或者说是一个事件队列~
 */

var utils = require('./utils')

function Batcher () {
    // 通过原型上的 reset 方法，初始化 batcher 实例，reset 同时可用于清空已有实例的队列。
    this.reset()
}

var BatcherProto = Batcher.prototype

// 该函数用于把回调参数推入当前 batcher 的队列。
/**
 * job 结构：{
 *      id, 表示当前回调参数的唯一标志
 *      override, 是否覆盖掉老的回调对象
 *      execute, 回调函数
 *      cancelled 是否取消执行
 * }
 */
BatcherProto.push = function (job) {
    // !job.id 是什么作用？这里本来是指如果 batcher 中没有当前回调对象，就存进去。
    if (!job.id || !this.has[job.id]) {
        this.queue.push(job)
        this.has[job.id] = job
        if (!this.waiting) {
            this.waiting = true  // 切换当前 batcher 的状态。
            utils.nextTick(utils.bind(this.flush, this))
        }
    } else if (job.override) {
        // 如果是覆盖类型的回调对象，那么就取消掉久对调的执行资格，推入新的回调对象。
        var oldJob = this.has[job.id]
        oldJob.cancelled = true
        this.queue.push(job)
        this.has[job.id] = job
    }
}

// 刷新 batcher，全部执行并清空。
BatcherProto.flush = function () {
    // before flush hook
    // 如果指定了 _preFlush，那么先指定 _preFlush。
    if (this._preFlush) this._preFlush()
    // do not cache length because more jobs might be pushed
    // as we execute existing jobs
    // 刷新对列，全部执行。不缓存队列的长度，因为 batcher 刷新的时候，可能有新的回调对象推入。
    for (var i = 0; i < this.queue.length; i++) {
        var job = this.queue[i]
        // 跳过被取消了执行资格的回调对象。
        if (!job.cancelled) {
            job.execute()
        }
    }
    // 刷新完以后，重置当前 batcher。
    this.reset()
}

// 初始化及重置的函数。
BatcherProto.reset = function () {
    // 存储回调的对象。
    this.has = utils.hash()
    // 存储回调对象的队列。
    this.queue = []
    // 表示当前 batcher 的状态，为 true 时是在等待执行。
    this.waiting = false
}

module.exports = Batcher