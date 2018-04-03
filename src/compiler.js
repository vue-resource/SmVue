/**
 * @author henyulee
 * @date   2018-03-29
 * @des   模板编译器  将view与model联系起来
 *        指令/文本节点/事件
 *        @待完成 组件
 */

var $$id = 0;

function Complier(opt) {
	this.$el = opt.el; //view
	this.now = opt.vm; //model
	this.init(); 
}
Complier.prototype = {
	constructor:Complier,
	init:function() {
		var self = this;
		self.frag = self.nodeToFragment();
		self.compile(self.frag);
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
	compile:function(node,scope) {
		var self = this;
		self.vm = scope || self.now;
		node.$id = $$id++;
		if(node.childNodes && node.childNodes.length > 0) {
			//把DOM节点转化为 【类数组】
			[].slice.call(node.childNodes).forEach(function(childNode) {
				if(childNode.nodeType === 1){//元素节点
					self.compileElementNode(childNode);
				}else if(childNode.nodeType === 3) {// 文本节点
					self.compileTextNode(childNode);
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
			if(dir.type) {
				if(dir.type === "for" || dir.type === "if"){
					lazyCompileDir = dir.type;
					lazyCompileExp = attr.value;
				}else {
					var hanlder = self[dir.type+"Handler"].bind(self);
					if(hanlder){
						hanlder(node,attr.value,dir.prop); 
					}else{
						console.error('找不到' + dir.type + '指令');
					}
				}
				node.removeAttribute(attr.name);
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
		this.bindWatcher({node:node,txt:txt,direct:"text"});
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
		var watcher = new Watcher({scope:self.vm,txt:txt,cb:function(newVal) {
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
	 		node.addEventListener(event,fn.bind(self)); // bind生成一个绑定this的新函数，而call和apply只是调用
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
				txt = '"' + (node.className || '') + ' "+' + self.parseClassExp(txt);
				break;
			case 'style':
				// style可以使用style.cssText/node.setAttribute('style','your style')全量更新，也可以使用style.prop单个更新
				// 全量更新只需要监听全量表达式即可，但是初次编译之后其他地方脚本改了propB的话，下一次更新propA也会使用vm的值去覆盖更改后的propB
				// 单个更新的话需要监听多个值，但是不同样式之间无影响，比如初次编译后脚本更改了propC，下一次更新propB是不会影响到propC的
				// 这里使用全量更新，样式写法是这样的：<div v-bind:style="{ color: activeColor, font-size: fontSize }"></div>
				var styleStr = node.getAttribute('style') || '';
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
		var tagname = node.tagName.toLowerCase();
		var tagType = node.type;
		var self = this;
	 	if(tagname === "input"){
	 		switch(tagType) {
	 			case "checkbox":
	 				self.bindWatcher({node:node,txt:txt,direct:"checkbox"});
		 			node.addEventListener("change",function(e) {
		 				var value = e.target.value;
		 				var index = self.vm[txt].indexOf(value);
		 				if(e.target.checked && index < 0) {
		 					self.vm[txt].push(value);
		 				}else if(!e.target.checked && index > -1){
		 					self.vm[txt].splice(index,1);
		 				}
		 			});
	 				break;
	 			case "radio":
	 				self.bindWatcher({node:node,txt:txt,direct:"radio"});
	 				node.addEventListener("change",function(e) {
	 					if(e.target.checked) {
	 						var _exp = txt +"='"+e.target.value +"'";
	 						with(self.vm) {
	 							eval(_exp);
	 						} 
	 					}
	 				});
	 				break;
	 			case 'file':
					self.bindWatcher({node:node,txt:txt,direct:'value'});
					node.addEventListener('change', function (e) {
						var _exp = txt + '=`' + e.target.value + '`';
						with (self.vm) {
							eval(_exp);
						}
					});
					break;
	 			default:
		 			self.bindWatcher({node:node,txt:txt,direct:"value"});
		 			node.addEventListener("input",function(e) {
		 				// 由于上面绑定了自动更新，循环依赖了，中文输入法不能用。这里加入一个标志避开自动update
		 				node.isInputting = true;
		 				var _exp = txt +"='"+e.target.value +"'"; //赞赞赞
		 				with(self.vm) {
		 					eval(_exp);
		 				}
		 			});
	 		}
	 	}
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
	ifHandler:function(node,txt) { // TODO
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
		var self = this;
		var scope = self.vm;
		var item = txt.split("in")[0].replace(/\s/g,'');
		var arr = txt.split("in")[1].replace(/\s/g,'');
		var parentNode = node.parentNode;
		var startNode = document.createTextNode('');
		var endNode = document.createTextNode('');
		var range = document.createRange();
		parentNode.replaceChild(startNode,node);
		parentNode.appendChild(endNode);
		var watcher = new Watcher({scope:scope,txt:arr,cb:function(newArr,oldArr,options) {
			range.setStart(startNode,0);
			range.setEnd(endNode,0);
			range.deleteContents();
			newArr.forEach(function(val,key) {
				var cloneNode = node.cloneNode(true);
				parentNode.insertBefore(cloneNode,endNode);
				// for循环内作用域绑定在当前作用域之下，注意每次循环要生成一个新对象
				var _scope = Object.create(scope);
				if(item.indexOf("(") > -1){
					var _arr = item.replace(/[\(\)]/g,'').split(",");
					_scope[_arr[0]] = key;
					_scope[_arr[1]] = val;
				}else {
					_scope.$index = key;// 增加$index下标
					_scope[item] = val; // 绑定item作用域
				}
				self.compile(cloneNode,_scope);  // TODO @FIXME 同样的编译应该有缓存机制
			});
		}});
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
		//添加一个Watcher，监听exp相关的所有字段变化
		var self = this;
		var updateSet = self.updater();
		var updateFn = updateSet[opt.direct]; //绑定节点对应的视图处理函数
		var watcher = new Watcher({scope:self.vm,txt:opt.txt,cb:function(newVal) {
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
		var regObj = /^\{(.+?)\}$/;  // :class={"classA":true,"classB":5>3}
		var regArr = /^\[(.+?)\]$/; // :class = ["a","b",5>3?"c":""]
		var result = [];
		if (regObj.test(txt)) {
			var subExp = txt.replace(/[\s\{\}]/g, '').split(',');
			subExp.forEach(function (sub) {
				var idx = sub.indexOf(":");
				var key = '"' + sub.substr(0,idx).replace(/['"`]/g, '') + ' "';
				var value = sub.substr(idx+1);
				result.push('((' + value + ')?' + key + ':"")');
			});
		} else if (regArr.test(txt)) {
			var subExp = txt.replace(/[\s\[\]]/g, '').split(',');
			result = subExp.map(function (sub) {
				return '(' + sub + ')' + '+" "';
			});
		}else {
			return '(' +txt +')';
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
		var self = this;
		var regObj = /^\{(.+?)\}$/; // :style={'width':100,'height':200}
		var regArr = /^\[(.+?)\]$/; // :style=[{'width':100,'height':200},{'top':30},{'backgroundColor':"#fff"}]
		var result = [];
		if (regObj.test(txt)) {
			var subExp = txt.replace(/[\s\{\}]/g, '').split(',');
			subExp.forEach(function (sub) {
				var idx = sub.indexOf(":");
				var key = '"' + sub.substr(0,idx).replace(/['"`]/g, '') + ':"+';
				var value = '(' +sub.substr(idx+1).replace(/['`]/g, '"') +')';
				result.push(key + value + '+";"');
			});
		} else if (regArr.test(txt)) {
			var subExp = txt.replace(/[\s\[\{\]\}]/g, '').split(','); //感觉实现起来有误 是不是应该 /[\s\[\{\]\}]/g
			result = subExp.map(function (sub) {
				//return '(' + sub + ')' + '+";"';
				var idx = sub.indexOf(":");
				var key = '"' + sub.substr(0,idx).replace(/['"`]/g, '') + ':"+';
				var value = '(' +sub.substr(idx+1).replace(/['`]/g, '"') +')';
				return key + value + '+";"';
			});
		}else {
			return '(' +txt +')'; // 
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
				break;
			case name.indexOf('@') === 0 :
				dir.type = "on";
				dir.prop = name.substring(1);
				break;
			case name.indexOf(':') === 0 :
				dir.type = "bind";
				dir.prop = name.substring(1);
				break;
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
			radio:function(node,newVal) {
				node.checked = node.value === newVal;
			},
			attr:function(node,newVal,attrName) {
				node.setAttribute(attrName, newVal ||"");
			},
			style: function (node, newVal, attrName) {
				if (attrName === 'display') {
					var isShow = newVal ? 'initial' : 'none';
				}
				node.style[attrName] = isShow;
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