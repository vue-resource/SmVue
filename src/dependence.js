/**
 * @author henyulee
 * @date   2018-03-30
 * @des   订阅系统/依赖系统
 *        订阅对象的列表
 */

function Dep() {
	this.subs = {};
}

Dep.prototype = {
	constructor:Dep,
	addSub:function(target) {
		if (!this.subs[target.uid]) {  //防止重复添加
			this.subs[target.uid] = target;
		}
	},
	notify:function(options) {
		for (var uid in this.subs) {
			this.subs[uid].update(options);
		}
	}
}