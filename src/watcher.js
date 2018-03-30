/**
 * @author henyulee
 * @date   2018-03-29
 * @des   监听/发布系统
 *        监听Observer的变更消息，获取最新值计算表达式，通过回调函数（updater函数）将计算结果更新到视图上
 */

/**
 * [Watcher 订阅系统]
 * @param {[object]} opt [参数对象]
 * @param {[object]} opt.scope [this指针对象]
 * @param {[string]} opt.txt [节点新值]
 * @param {[function]} opt.cb [接收到消息后的处理即，model => view ]
 */
function Watcher(opt) {
	this.scope = opt.scope;
	this.txt = opt.txt;
	this.callback = opt.cb || function() {};
	this.value = null;
	this.update();
}

Watcher.prototype = {
	constructor:Watcher,
	/**
	 * [get 处理从模板中解析出来的字符串]
	 * @return {[js-Object]} [把字符串转化为js能直接执行的语句]
	 */
	get:function() {
		var self = this;
		Dep.target = self;
		var value = Tools.computeExpression(self.txt,self.scope);
		Dep.target = null;
		return value;
	},
	/**
	 * [update model => view ]
	 * @return {[null]} [回调函数更新视图，实现 model => view ]
	 */
	update:function(options) {
		var self = this;
		var newVal = self.get();
		if(!Tools.isEqual(self.value,newVal)){ //值发生了改变
			self.callback && self.callback(newVal,self.value,options);
			self.value = Tools.deepCopy(newVal);
		}
	}
}