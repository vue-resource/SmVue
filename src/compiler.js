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
		this.compile(self.frag);
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
	compile:function(node) {
		var self = this;
		if(node.childNodes && node.childNodes.length > 0) {
			//把DOM节点转化为 【类数组】
			[].slice.call(node.childNodes).forEach(function(node) {
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
		var self = this;
		var lazyCompileDir ="",lazyCompileExp = ""; //仅v-if,v-for等惰性指令使用
		var attrlist = [].slice.call(node.attributes); //attributes是动态的，要复制到数组里面去遍历
		attrlist.forEach(function(attr) {
			var dir = self.checkDirective(attr.name);
			if(dir.type === "for" || dir.type === "if"){
				lazyCompileDir = dir.type;
				lazyCompileExp = attr.value;
			}else if(dir.type !== undefined){
				var hanlder = self[dir.type+"Handler"].bind(self);
				if(hanlder){
					hanlder(node,attr.value,dir.prop); 
				}else{
					console.error('找不到' + dir.type + '指令');
				}
			}
		});
		// if/for懒编译（编译完其他指令后才编译）
		if(lazyCompileExp){
			self[lazyCompileDir+"Handler"](node,lazyCompileExp);
		}else{
			self.compile(node);
		}
	},
	/**
	 * 指令处理，指令主要有：
	 * v-text： 表达式编译 @done
	 * v-html： html编译，要做一定的xss拦截@done
	 * v-on：事件绑定 @done
	 * v-model：数据视图双向绑定 @done
	 * v-bind：控制属性
	 * v-show：控制可视化属性，可归在v-bind内
	 * v-if、v-for、v-else（暂不做）：控制流，根据当前值会对子元素造成影响：
	 * v-pre、v-cloak、v-once：控制不编译、保持内容不变，单次编译暂时不做：
	 * */

	 /**
	 * [textHandler v-text]
	 * @return {[null]} [v-text="expression"]
	 */
	textHandler:function(node,txt) {
		self.bindWatcher({node:node,txt:txt,direct:"text"});
	},
	/**
	 * [htmlHandler v-html]
	 * @param  {[dom]} node [节点]
	 * @param  {[string]} txt  [html结构]
	 * @return {[null]}      [无]
	 */
	htmlHandler:function(node,txt) {
		var self = this;
		var updateFn = (self.updater())["html"];
		var watcher = new Watcher({scope:self,txt:txt,cb:function(newVal) {
			updateFn && updateFn(node, newVal);
			self.compile(node);
		}});
	},

	 /**
	  * [onHandler v-on || @事件名]
	  * @param  {[dom]} node  [元素节点]
	  * @param  {[function]} txt   [事件处理程序]
	  * @param  {[string]} event [事件名]
	  * @return {[null]}       [无]
	  * @PS 三种形式：v-on:click="handler"， v-on:click="handler($index)"， v-on:click="count=count+1"
	  */
	 onHandler:function(node,txt,event) {
	 	var self = this;
	 	if(!event) {console.error("请指定事件类型！");return;}
	 	var fn = self.vm[txt];
	 	if(typeof fn === "function"){
	 		node.addEventListener(event,fn.bind(self))// bind生成一个绑定this的新函数，而call和apply只是调用
	 	}else {
	 		node.addEventListener(event,function() {
	 			Tools.computeExpression(txt,self.vm);
	 		});
	 	}
	 },

	 /**
	  * [bindHandler v-bind || :属性名]
	  * @param  {[dom]} node  [元素节点]
	  * @param  {[string]} txt   [属性变量]
	  * @param  {[string]} attr [属性名]
	  * @return {[null]}       [无]
	  * @PS 三种形式：v-bind:id="id", v-bind:class="cls"
	  */
	 bindHandler:function(node,txt,attr) {
	 	var self = this;
	 	switch (attr) {
			case 'class':
				// 拼成 "baseCls "+(a?"acls ":"")+(b?"bcls ":"")的形式
				txt = '"' + node.className + ' "+' + self.parseClassExp(txt);
				break;
			case 'style':
				// style可以使用style.cssText/node.setAttribute('style','your style')全量更新，也可以使用style.prop单个更新
				// 全量更新只需要监听全量表达式即可，但是初次编译之后其他地方脚本改了propB的话，下一次更新propA也会使用vm的值去覆盖更改后的propB
				// 单个更新的话需要监听多个值，但是不同样式之间无影响，比如初次编译后脚本更改了propC，下一次更新propB是不会影响到propC的
				// 这里使用全量更新，样式写法是这样的：<div v-bind:style="{ color: activeColor, font-size: fontSize }"></div>
				var styleStr = node.getAttribute('style');
				txt = '"' + styleStr + ';"+' + self.parseStyleExp(txt);
				break;
		}
		self.bindWatcher({node:node,txt:txt,direct:'attr',prop:attr});
	 },

	 /**
	  * [modelHandler 处理表单]
	  * @param  {[dom]} node  [元素节点]
	  * @param  {[string]} txt   [表单值]
	  * @param  {[prop]} prop [修饰符]
	  * @return {[null]}       [无]
	  * @PS 三种形式：v-on:click="handler"， v-on:click="handler($index)"， v-on:click="count=count+1"
	  */
	 
	 /**
	 * model双向绑定，v-model="expression"
	 * 不同的元素绑定的值不同：checkbox、radio绑定的是checked，其他为value
	 * 不同的元素也有不同的处理方式：checkbox处理value数组，其他处理value的单值
	 * */

	modelHandler:function(node,txt,prop) {
	 	//if(node.tagName.toLowercase() === "input") {
	 	//	switch(node.type) {
	 	//		case "checkbox":
	 	//			this.bindWatcher({node:node,txt:txt,direct:"checkbox"});
//
	 	//			break;
	 	//		case "radio":
	 	//			break;
	 	//		case "file":
	 	//			break;
	 	//		default:
	 	//	}
	 	//}
	},
	/**
	 * [showHandler v-show]
	 * @param  {[dom]} node [节点]
	 * @param  {[string]} txt  [description]
	 * @return {[null]}      [无]
	 */
	showHandler:function(node,txt) {
		this.bindWatcher({node:node,txt:txt,direct:"style",prop:"display"})
	},
	/**
	 * [showHandler v-if]
	 * @param  {[dom]} node [节点]
	 * @param  {[string]} txt  [description]
	 * @return {[null]}      [无]
	 */
	ifHandler:function(node,txt) {
		// 先编译子元素，然后根据表达式决定是否插入dom中
		// PS：这里需要先插入一个占位元素来定位，不能依赖其他元素，万一其他元素没了呢？
		this.compile(node);
		var refNode = document.createTextNode('');
		node.parentNode.insertBefore(refNode, node);
		var current = node.parentNode.removeChild(node);
		this.bindWatcher({node:current, txt:txt, direct:'dom', prop:refNode}); // refNode是引用关系，移动到parentNode后会自动更新位置，所以可以传入
	},

	/**
	 * [forHandler v-for="item in items"]
	 * @param  {[dom]} node [节点]
	 * @param  {[string]} txt  [description]
	 * @return {[null]}      [无]
	 */
	forHandler:function(node,txt) {
		// TODO 
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
		self.textHandler(node,_txt);
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
		var watcher = new Watcher({scope:self,txt:opt.txt,cb:function(newVal) {
			updateFn && updateFn(opt.node, newVal, opt.prop);
		}});
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
	 * [parseClassExp v-bind:class || :class]
	 * @param  {[string]} txt [class字符串]
	 * @return {[string]}     [解析class表达式]
	 */
	parseClassExp:function(txt) {
		// 拼成 (a?"acls ":"")+(b?"bcls ":"")的形式
		if (!txt) { return; }
		var regObj = /\{(.+?)\}/g;  // :class={"classA":true,"classB":5>3}
		var regArr = /\[(.+?)\]/g; // :class = ["a","b",5>3?"c":""]
		var result = [];
		if (regObj.test(txt)) {
			var subExp = txt.replace(/[\s\{\}]/g, '').split(',');
			subExp.forEach(function (sub) {
				var key = '"' + sub.split(':')[0].replace(/['"`]/g, '') + ' "';
				var value = sub.split(':')[1];
				result.push('((' + value + ')?' + key + ':"")')
			});
		} else if (regArr.test(txt)) {
			var subExp = txt.replace(/[\s\[\]]/g, '').split(',');
			result = subExp.map(function (sub) {
				return '(' + sub + ')' + '+" "';
			});
		}else {
			result.push(txt);
		}
		return result.join('+');  // 拼成 (a?"acls ":"")+(b?"bcls ":"")的形式
	},
	/**
	 * [parseStyleExp v-bind:style || :style]
	 * @param  {[string]} txt [style字符串]
	 * @return {[string]}     [解析style表达式]
	 */
	parseStyleExp:function(txt) {
		if (!txt) { return; }
		var regObj = /\{(.+?)\}/g; // :style={'width':100,'height':200}
		var regArr = /\[(.+?)\]/g; // :style=[{'width':100,'height':200},{'top':30},{'backgroundColor':"#fff"}]
		var result = [];
		if (regObj.test(txt)) {
			var subExp = txt.replace(/[\s\{\}]/g, '').split(',');
			subExp.forEach(function (sub) {
				var key = '"' + sub.split(':')[0].replace(/['"`]/g, '') + ':"+';
				var value = sub.split(':')[1];
				result.push(key + value + '+";"');
			});
		} else if (regArr.test(exp)) {
			var subExp = exp.replace(/[\s\[\]]/g, '').split(','); //感觉实现起来有误 是不是应该 /[\s\[\{\]\}]/g
			result = subExp.map(function (sub) {
				return '(' + sub + ')' + '+";"';
			});
		}
		return result.join('+');  // 拼成 (width:100;)+(height:5>3?200:100;)的形式
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
	/**
	 * [checkDirective 检查属性，返回指令类型]
	 * @param  {[string]} name [指令名称]
	 * @return {[object]}      [返回该指令及其修饰符]
	 */
	checkDirective:function(name) {
		var dir = {};
		switch(true) {
			case name.indexOf('v-') === 0 :
				var parse = name.substring(2).split(":");
				dir.type = parse[0];
				dir.prop = parse[1];
			case name.indexOf('@') === 0 :
				dir.type = "on";
				dir.prop = name.substring(1);
			case name.indexOf(':') === 0 :
				dir.type = "bind";
				dir.prop = name.substring(1);
		}
		return dir;
	},
	updater:function() {
		return {
			text:function(node,newVal) {
				node.textContent = newVal || "";
			},
			html: function(node, newVal) {
				node.innerHTML = newVal || "";
			},
			value:function(node,newVal) {
				// 当有输入的时候循环依赖了，中文输入法不能用。这里加入一个标志避开自动update
				if (!node.isInputting) { //哪来的isInputting
					node.value = newVal || '';
				}
				node.isInputting = false;  // 记得要重置标志
			},
			checkbox: function (node, newVal) {
				// 处理数组
				var value = node.value;
				node.checked = newVal.indexOf(value) > -1;
			},
			attr:function(node,newVal,attrName) {
				node.setAttribute(attrName, newVal ||"");
			},
			style: function (node, newVal, attrName) {
				if (attrName === 'display') {
					newVal = newVal ? 'initial' : 'none';
				}
				node.style[attrName] = newVal;
			},
			dom: function (node, newVal, nextNode) {
				if (newVal) {
					nextNode.parentNode.insertBefore(node, nextNode);
				} else {
					nextNode.parentNode.removeChild(node);
				}
			}
		}
	}
}