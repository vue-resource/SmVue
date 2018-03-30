/**
 * @author henyulee
 * @date   2018-03-30
 * @des   观察者系统
 *        实现对viewModel的监视，当发生变更时发出变更消息
 */

function Observer(data) {
	this.data = data;
	this.observe(data);
}
Observer.prototype = {
	constructor:Observer,
	/**
	 * [observe 监听器]
	 * @param  {[未知]} data [要监听的数据]
	 * @return {[null]}      [无]
	 */
	observe:function(data) {
		var self = this;
		// 设置开始和终止的递归条件
		if(!data || typeof data !== 'object') return;
		// 对数据的节点信息设置访问器
		Object.keys(data).forEach(function(key) {
			self.observeObject(data,key,data[key]);
		});
	},
	/**
	 * [observeObject 监听单元]
	 * @param  {[object]} obj [监听的数据]
	 * @param  {[string]} key [要监听的数据节点]
	 * @param  {[未知]} val [数据节点原始值]
	 * @return {[null]}     [无]
	 */
	observeObject:function(obj,key,val) {
		var dep = new Dep(); // 每个变量单独一个dependence列表
		var self = this;
		Object.defineProperty(obj,key,{
			enumerable  : true,    // 枚举
			configurable: false,   // 不可再配置
			get:function() {
				// 由于需要在闭包内添加watcher，所以通过Dep定义一个全局target属性，暂存watcher, 添加完移除
				Dep.target && dep.addSub(Dep.target);
				return val;
			},
			set:function(newVal) {
				if(newVal === val) return;
				val = newVal; // setter本身已经做了赋值，val作为一个闭包变量，保存最新值
				if(Array.isArray(newVal)) {
					self.observeArray(newVal,dep);
				}else {
					self.observe(newVal);
				}
				dep.notify();
			}
		});
		// 没搞懂为何要写2次
		if (Array.isArray(val)) {
			self.observeArray(val, dep);  // 递归监视，数组的监视要分开
		} else {
			self.observe(val);   // 递归对象属性到基本类型为止
		}
	},
	/**
	 * [observeArray 监听数组]
	 * @param  {[array]} arr [要监听的数组]
	 * @param  {[object]} dep [订阅对象]
	 * @return {[null]}     [无]
	 */
	observeArray:function(arr,dep) {
		var self = this;
		// 没搞懂
		arr.__proto__ = self.defineReactiveArray(dep);
		arr.forEach(function(item) {
			self.observe(item);
		});
	},
	/**
	 * [defineReactiveArray 改写Array的原型实现数组方法监视]
	 * @param  {[object]} dep [依赖对象]
	 * @return {[null]}     [无]
	 */
	defineReactiveArray:function(dep) {
		var self = this;
		var arrayPrototype = Array.prototype;
		var arrayMethods = Object.create(arrayPrototype); //关联到数组的原型对象
		var methods = ["push","pop","shift","unshift","splice","sort","reverse"]; //将要重写的原型方法
		methods.forEach(function(method) {
			Object.defineProperty(arrayMethods,method,{
				enumerable  : true,
				writable    : true,
				configurable: true,
				value:function() {
					var originMethod = arrayPrototype[method]; //原型链上的初始方法
					var args = [];// 获取函数参数
					for(var i=0,len = arguments.length;i<len;i++){
						args.push(arguments[i]);
					}
					var value = originMethod.apply(this,args);//把原型的数组方法转嫁到改写之后的数组上
					var interate;
					switch(method) {
						case 'push':
						case 'unshift':
							interate = args;break;
						case 'splice':
							interate = args.slice(2);//只要那些插入到数组中的成员 
					}
					if(interate && interate.length > 0){
						self.observeArray(interate,dep);
					}
					//触发更新
					dep.notify({method,args});
					return value;
				}
			});
		});
		/**
		 * 在不改变数组原型的前提下，全局扩充数组方法
		 *   $set  : 设置/替换方法 
		 *   	@param {[string]} [index] [索引]
		 *   	                     [value] [新值]
		 *   $remove 删除方法
		 *   	@param {[string]} [item] [要删除的元素]
		 */
		
		Object.defineProperty(arrayMethods,"$set",{
			value:function(index,value) {
				if(index > this.length) index = this.length;
				return this.splice(index,1,value)[0];
			}
		});

		Object.defineProperty(arrayMethods,"$remove",{
			value:function(item) {
				var index = this.indexOf(item);
				if(index > -1){
					return this.splice(index,1);
				}
			}
		});
		return arrayMethods;
	}
}


