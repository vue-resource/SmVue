/**
 * @author henyulee
 * @date   2018-03-29
 * @des   工具集
 */

var Tools = {
	/**
	 * [computeExpression 把js字符串转化为js能直接执行的脚本]
	 * @param  {[string]} txt [js字符串]
	 * @param  {[object]} scope [作用域]
	 * @return {[js-object]}     [能直接执行的脚本]
	 *  PS：with+eval会将表达式中的变量绑定到scope（vm）模型中，从而实现对表达式的计算
	 */
	computeExpression:function(txt,scope) {
		try{
			with(scope){
				return eval(txt);
			}
		}catch(e){
			console.log("Returns an error message:",e);
		}
	},
	/**
	 * [isEqual 比较2个值是否完全相等]
	 * @param  {[未知]}  origin [目标]
	 * @param  {[未知]}  target [参考对象]
	 * @return {Boolean}        [返回是否相等]
	 */
	isEqual:function(origin,target) {
		var self = this;
		return origin === target || (
			self.isObject(origin) && self.isObject(target) ? JSON.stringify(origin) === JSON.stringify(target) : false
		)
	},
	/**
	 * [isObject 判断一个值是否为对象]
	 * @param  {[未知]}  obj [目标对象]
	 * @return {Boolean}     [数据类型是否为对象]
	 */
	isObject:function(obj) {
		return obj !== null && typeof obj === "object";
	},
	/**
	 * [deepCopy 深拷贝]
	 * @param  {[未知]}  obj [目标对象]
	 * @return {[未知]} [深拷贝结果]
	 */
	deepCopy:function(obj) {
		var self = this;
		if(self.isObject(obj)){
			return JSON.parse(JSON.stringify(obj));
		}
		return obj;
	}
};