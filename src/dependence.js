/**
 * @author henyulee
 * @date   2018-03-30
 * @des   订阅系统/依赖系统
 *        订阅对象的列表
 */

function Dep() {
	this.subs = [];
}

Dep.prototype = {
	constructor:Dep,
	addSub:function(target) {
		this.subs.push(target);
	},
	notify:function(options) {
		var self = this;
		self.subs.forEach(function(sub) {
			sub.update(options);
		});
	}
}