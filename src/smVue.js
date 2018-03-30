/**
 * @author henyulee
 * @date   2018-03-29
 * @des   框架主体
 *        @子模块  data/method/computed
 *        @待加入  component/props
 */

function SMVue(options) {
	this.$el = typeof options.el === "string" ? document.querySelector(options.el) : options.el || document.body; 
	this.$data = options.data;
	this.$options = Object.assign({},{methods:{},computed:{}},options);
	this.init();
}

SMVue.prototype = {
	constructor:SMVue,
	init:function() {
		var self = this;
		self._proxy();
		self._proxyMethods();
		
		var ob = new Observer(this.$data);
		if (!ob) return;
		/**
		 * 开始执行编译
		 * @type {[Object]}
		 */
		new Complier({ el:self.$el, vm:self });
	},
	/**
	 * 代理属性，直接用vm.属性名来访问data和computed的属性
	 * @return {null} [用来劫持data和computed的属性，设置set和get拦截器]
	 */
	_proxy:function() {
		var self = this;
		var props = ["data","computed"];
		props.forEach(function(item) {
			Object.keys(self.$options[item]).forEach(function(key) {
				Object.defineProperty(self,key,{
					configurable : false,
					enumerable   :  true,
					get          : function() {
						if(typeof self.$data[key] !== 'undefined'){ //属性在data属性上
							return self.$data[key];
						}else if(typeof self.$options.computed[key] !== 'undefined'){
							//改变this指向，也就实现了在computed中可以访问data里的属性，从而实现计算
							return self.$options.computed[key].call(self);//
						}
						return undefined;
					},
					set 		 : function(newVal) {
						if(self.$data.hasOwnProperty(key)){ //只有data里的属性支持写入，conputed里的属性不支持写入
							self.$data[key] = newVal;
						}
					}
				});
			});
		});
	},
	/**
	 * 代理方法
	 * @return {null} [把方法劫持到vm上，通过vm直接使用]
	 * @PS  方法不需要定义 get,set,直接执行
	 */
	_proxyMethods:function() {
		var self = this;
		Object.keys(self.$options.methods).forEach(function(method) {
			self[method] = self.$options.methods[method];
		})
	}
}
