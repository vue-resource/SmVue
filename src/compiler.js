/**
 * @author henyulee
 * @date   2018-03-29
 * @des   模板编译器  将view与model联系起来
 *        指令/文本节点/事件
 *        @待完成 组件
 */
function Complier(opt) {
	this.$el = opt.el; //view
	this.vm = opt.vm; //model
	this.init(); 
}
Complier.prototype = {
	constructor:Complier,
	init:function() {
		var self = this;
		self.frag = self.nodeToFragment();
		self.$el.appendChild(self.frag);
	},
	/**
	 * 文档片段
	 * @return {dom} [创建一个文档片段，把模板里的dom结构都放到这个虚拟的文档片段中]
	 */
	nodeToFragment:function() {
		var self = this;
		var frag = document.createDocumentFragment();
		var child;
		while(child = self.$el.firstChild) {
			if(self.isIgnorable(child)){
				self.$el.removeChild(child);
			}else{
				frag.appendChild(child); // 移动操作，将child从原位置移动添加到frag
			}
		}	
		return frag;
	},
	/**
	 * [编译文档片段]
	 * @return {[null]} [在这里对元素，指令，属性，文本节点执行编译]
	 */
	compile:function() {
		var self = this;
		if(self.frag.childNodes && self.frag.childNodes.length > 0) {
			//把DOM节点转化为 【类数组】
			[].slice.call(self.frag.childNodes).forEach(function(node) {
				if(node.nodeType === 1){//元素节点
					self.compileElementNode(node);
				}else if(node.nodeType === 3) {// 文本节点
					self.compileTextNode(node);
				}
			});
		}
	},
	/**
	 * [compileElementNode 编译元素节点]
	 * @return {[null]} [在这里会判断【指令】等一些列问题]
	 */
	compileElementNode:function(node) {

	},
	/**
	 * [compileTextNode 编译文本节点]
	 * @return {[null]} [会处理【{{}}】或者【{{{}}}】这一些列问题
	 */
	compileTextNode:function(node) {
		var self = this;
		var txt = node.textContent.trim();
		if(txt === "") return;
		var _txt = self.parseTextExp(txt);
		self.bindWatcher({node:node,txt:_txt,direct:"text"});
	},
	/**
	 * [bindWatcher 监听器]
	 * @param  {[object]} opt   [形参]
	 * @param  {[dom]} opt.node   [检测的dom节点]
	 * @param  {[string]} opt.txt    [节点文本内容]
	 * @param  {[string]} opt.direct [指令名称]
	 * @param  {[string]} opt.prop [修饰符，属性名]
	 * @return {[null]}        [监听处理]
	 */
	bindWatcher:function(opt) {
		var self = this;
		var updateSet = self.updater();
		var updateFn = updateSet[opt.direct]; //绑定节点对应的视图处理函数
	},
	/**
	 * [parseTextExp 用来处理文本节点中的表达式]
	 * @param  {[string]} txt [文本内容]
	 * @return {[string]}     [把 'a {{b+"text"}} c {{d+Math.PI}}' => '"a " + b + "text" + " c" + d + Math.PI' 的格式]
	 */
	parseTextExp:function(txt) {
		var reg = /\{\{(.+?)\}\}/g;
		var pieces = txt.split(reg); // ["a ", "b+"text"", " c ", "d+Math.PI", ""]
		var matchs = txt.match(reg); // ["{{b+"text"}}", "{{d+Math.PI}}"]
		var arr = [];
		pieces.forEach(function(piece) {
			if(matchs && matchs.indexOf('{{'+piece+'}}') > -1){
				arr.push(piece);
			}else {
				arr.push("'"+piece+"'");
			}
		});
		return arr.join('+');
	},
	/**
	 * 设置编译忽略规则
	 * @return {Boolean} [判断编译时是否可以忽略，比如换行符，空白符，注释节点……]
	 */
	isIgnorable:function(node) {
		var reg = /^[\t\n\r]+/;
		/**
		 * 注释节点，空白符
		 * @nodeType 
		 * 		注释节点 8   文本节点 3
		 * @空白符
		 * 	    \t 制表符   \n  换行符    \r 换行符
		 */
		return (node.nodeType === 8) || ((node.nodeType === 3) && reg.test(node.textContent));
	},
	updater:function() {
		return {
			text:function(node,newVal) {
				node.textContent = newVal || "";
			}
		}
	}
}