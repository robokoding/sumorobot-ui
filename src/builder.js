var FnInstance = function(fn, el, sumorobot){
  this.fn = fn;
  this.el = el;
  this.sumorobot = sumorobot;
  this.parent = false;
  this.children = [];
  this.name = 'none';
}

var addIfField = function() {
  var el = $("#program div.hidden")[0];
  if (el.length != 0) {
    $(el).removeClass("hidden");
    $(el).addClass("visible");
  }
};

var removeIfField = function() {
  var el = $("#program div.visible")[0];
  if (el.length != 0) {
    $(el).removeClass("visible");
    $(el).addClass("hidden");
  }
};

FnInstance.prototype = {
  run: function(children){
    var self = this;
    if(self.fn){
      // This is a function
      self.fn.run(self, self.sumorobot, function(state){ self.updateState(state)});
    }else{
      // This is the root container
      for(var i in self.children){
        self.children[i].run();
      }
    }
  },
  updateState: function(state){
    if(state === 'started'){
      $(this.el).addClass('active');
    }else if(state === 'complete'){
      $(this.el).removeClass('active');
    }
    if(this.parent && this.parent.el){
      this.parent.updateState(state);
    }
  },
  addChild: function(child){
    child.parent = this;
    this.children.push(child);
  },
  args: function(){
    var self = this;
    var args ={}
    if(this.fn){
      snack.each(this.fn.content, function(item){
        if(typeof item === 'object'){
          args[item.name] = self.el.querySelector('[name='+ item.name + ']').value;
        }
      });
    }
    return args;
  },
  toObject: function(){
    var out = {
      fn: this.fn ? this.fn.name : 'root',
      parent: this.fn ? this.fn.type === 'parent' : true,
      belongs: this.belongs,
      args: this.args(),
      children: []
    }
    if(this.children.length){
      out.children = this.children.map(function(c){ return c.toObject(); });
    }
    return out;
  }
}

var Builder = function(el, sumorobot){
  var self = this;
  this.el = el;
  this.sumorobot = sumorobot;
  this.init();
  this.fns = {};
  this.paused = false;

  snack.each(this.functions, function(f){
    self.fns[f.name] = f;
  });
}

Builder.prototype = {
  prog:null,
  init: function(){
    var self = this;
    var adjustment;
    this.el.addClass('editor');
    this.el[0].innerHTML = this.mainUI;
    this.setSize();
    window.addEventListener('resize', function(){self.setSize();});

    // Stop the whole page scrolling in touch browsers except in the program
    document.addEventListener('touchmove', function(e) {
      var el = e.target;
      while(el = el.parentElement){
        if(el.id === 'program'){
          return;
        }
      }
      e.preventDefault();
    }, false);
    
    this.runner = $('.editor .run');
    this.pause = $('.editor .pause');
    this.stop = $('.editor .stop');
    this.clear = $('.editor .clear');
    this.runner.attach('click', function(e){self.runProgram()});
    this.pause.attach('click', function(e){self.pauseProgram()});
    this.stop.attach('click', function(e){self.stopProgram()});
    this.clear.attach('click', function(e){self.clearProgram()});
    this.sumorobot.addListener(function(state){ self.sumorobotHandler(state) });

    this.addFunctions();
    this.resumeProgram();
  },
  supportsLocalStorage: function(){
    try {
      return 'localStorage' in window && window['localStorage'] !== null;
    } catch (e) {
      return false;
    }
  },
  storeProgram: function(){
    if(this.supportsLocalStorage()){
      var prog = new FnInstance(null, null, null);
      this.generate($('.editor ol.program')[0], prog);
      localStorage['sumorobot.currentProgram'] = JSON.stringify(prog.toObject());
    }
  },
  resumeProgram: function(){
    if(this.supportsLocalStorage() && localStorage['sumorobot.currentProgram']){
      var prog = JSON.parse(localStorage['sumorobot.currentProgram']);
      if(prog.fn === 'root' && prog.children && prog.children.length > 0){
        this.instantiateProgram(prog.children, document.querySelectorAll('.editor .program'));
        this.showHints();
        this.sortLists();
      }
    }
  },
  instantiateProgram: function(fns, el){
    var self = this;
    if(fns && fns.length){
      for(var i = 0; i< fns.length; i++){
        var newEl = document.querySelectorAll('.functionList .fn-' + fns[i].fn)[0].cloneNode(true);
        if (fns[i].belongs === 'if_do') el[1].appendChild(newEl);
        // parse the index from the name and make the element visible xD
        else if (fns[i].belongs.indexOf('else_if') > -1) {
          var index = parseInt(fns[i].belongs.split('else_if')[1])+2;
          el[index].appendChild(newEl);
          $(el[index].parentNode.parentNode).removeClass('hidden');
          $(el[index].parentNode.parentNode).addClass('visible');
        }
        else if (fns[i].belongs === 'else') el[12].appendChild(newEl);
        else el[0].appendChild(newEl);
        for(var arg in fns[i].args){
          if(fns[i].args.hasOwnProperty(arg)){
            var input = newEl.querySelector("[name='" + arg + "']");
            input.value = fns[i].args[arg];
          }
        }
        self.checkForChanges(newEl);
        snack.wrap(newEl).draggableList({
          target: 'ol.program',
          placeholder: '<li class="placeholder"/>',
          copy: false,
          ondrag: function(){self.showHints()},
          onchange: function(){self.storeProgram(); self.sortLists();}
        });
        if(fns[i].parent){
          this.instantiateProgram(fns[i].children, newEl.getElementsByTagName('ol'));
        }
      }
    }
  },
  setSize: function(){
    var w = window,
      d = document,
      e = d.documentElement,
      g = d.getElementsByTagName('body')[0],
      x = w.innerWidth || e.clientWidth || g.clientWidth,
      y = w.innerHeight|| e.clientHeight|| g.clientHeight;
    var right = this.el[0].getElementsByClassName('right')[0];
    var prog = this.el[0].getElementsByClassName('programWrapper')[0];
    var buttons = this.el[0].getElementsByClassName('buttons')[0];
    right.style.height = y - right.offsetTop - 27 + 'px';
    prog.style.height = buttons.offsetTop - prog.offsetTop + 'px';
  },
  sumorobotHandler: function(state){
    if(state === 'program_complete'){
      this.runner.show();
      this.pause.hide();
    }
  },
  showHints: function(){
    $('.editor .programWrapper ol').each(function(el){
      el.getElementsByClassName('hint')[0].style.display = (el.children.length === 1 ? 'block' : 'none')
    });
  },
  sortLists: function(){
    var ends = this.el[0].querySelectorAll('.programWrapper li.end')
    snack.each(ends, function(end){
      end.parentNode.appendChild(end);
    });
  },
  checkForChanges: function(elem){
    var self = this;
    var inputs = elem.querySelectorAll('input, select');
    snack.each(inputs, function(el){
      el.addEventListener('change', function(){ self.storeProgram();});
    });
  },
  addFunctions: function(){
    var self = this;
    snack.each(this.functions, function(i, f){
      f = self.functions[f];
      var fn = '<li class="function fn-' + f.name + ' draggable" data-fntype="' + f.name + '">';
      for(var i in f.content){
        if(typeof(f.content[i]) === 'string'){
          if(f.content[i] === 'Else do' || f.content[i] === 'Do')
            fn += '<br><span> ' + f.content[i] + ' </span>';
          else fn += '<span> ' + f.content[i] + ' </span>';
        }else if(typeof(f.content[i]) === 'object'){
          if(f.content[i].input === 'number'){
            fn += '<input type="number" size="4" name="' + f.content[i].name + '" value="' + f.content[i].default + '" />';
          }else if(f.content[i].input === 'option'){
            var select = '<select name="'+ f.content[i].name +'">';
            for(var j in f.content[i].values){
              select += '<option value="' + f.content[i].values[j] + '"';
              if(f.content[i].default === f.content[i].values[j]){
                select += 'selected="selected"';
              }
              select += '>' + f.content[i].values[j] + '</option>';
            }
            select += '</select>';
            fn += select;
          }else if(f.content[i].input === 'if_child'){
            if(f.content[i].name === 'if'){
              fn += '<div style="clear:both;"><div class="if-left"><span>' + f.content[i].label1 + '</span>';
              fn += '<ol name="if"><li class="end if"><div class="hint">Drag Enemy or Line here!</div></li></li></ol></div>';
              fn += '<div class="if-right"><span>' + f.content[i].label2 + '</span>';
              fn += '<ol name="if_do"><li class="end func"><div class="hint">Drag functions into here!</div></li></li></ol></div></div>';
            }else if (f.content[i].name.indexOf('else_if') > -1){
              // magic name formula xD
              var id = parseInt(f.content[i].name.split('else_if')[1]);
              var name = 'else_if' + id * 2;
              var name2 = 'else_if' + (id * 2 + 1);
              // add the div
              fn += '<div style="clear:both;"><div class="' + f.content[i].class + '"><div class="if-left"><span>' + f.content[i].label1 + '</span>';
              fn += '<ol name="' + name + '"><li class="end if"><div class="hint">Drag Enemy or Line here!</div></li></li></ol></div>';
              fn += '<div class="if-right"><span>' + f.content[i].label2 + '</span>';
              fn += '<ol name="' + name2 + '"><li class="end func"><div class="hint">Drag functions into here!</div></li></li></ol></div></div></div>';
            }else{
              fn += '<div style="clear:both;"><div class="if-left"><span>' + f.content[i].label + '</span>';
              fn += '<ol name="else"><li class="end func"><div class="hint">Drag functions into here!</div></li></li></ol></div></div>';
              fn += '<div class="if-right">';
            }
          }else if(f.content[i].input === 'button'){
            fn += '<input type="button" value="' + f.content[i].value + '" name="' + f.content[i].name + '" onclick="' + f.content[i].onclick + '"></input>';
          }
        }
      }
      if(f.name === 'if'){
        fn += '</div></div><div style="clear:both;">'
      }else if(f.type === 'parent'){
        fn += '<ol><li class="end func"><div class="hint">Drag functions into here!</div></li></li></ol>';
      }
      fn += '</li>';
      $('.editor .functionList')[0].innerHTML += fn;
    });
    $('.functionList li.draggable').draggableList({
      target: 'ol.program',
      placeholder: '<li class="placeholder"/>',
      copy: true,
      ondrag: function(){self.showHints()},
      onchange: function(){self.storeProgram(); self.sortLists();},
      onaddelem: function(elem){self.checkForChanges(elem);}
    });
  },
  runProgram: function(){
    //if(this.following || this.colliding){ return; }
    if(this.paused){
      this.sumorobot.resume();
    }else{
      this.prog = new FnInstance(null, null, null);
      this.generate($('.editor ol.program')[0], this.prog);
      this.prog.run()
    }
    this.pause.show();
    this.runner.hide();
    this.paused = false;
  },
  pauseProgram: function(){
    var self = this;
    this.paused = true;
    this.sumorobt.pause(function(){
      self.runner.show();
      self.pause.hide();
    });
  },
  stopProgram: function(cb){
    var self = this;
    this.sumorobot.stop(function(){
      self.runner.show();
      self.pause.hide();
      self.paused = false;
      cb && cb();
    });
  },
  clearProgram: function(){
    this.stopProgram();
    $('.editor ol.program li.function').remove();
    this.storeProgram();
    this.showHints();
  },
  generate: function(el, parent){
    var self = this, parentName = '';
    snack.each(el.childNodes, function(el){
      parentName = el.parentNode.getAttribute("name");
      if(el.nodeName.toLowerCase() === 'li' && el.className.match(/function/) && el.dataset.fntype){
        var fn = self.fns[el.dataset.fntype];
        var inst = new FnInstance(fn, el, self.sumorobot);
        inst.belongs = parentName || 'none';
        parent.addChild(inst);
        if(fn.name === 'if'){
          self.generate(el.querySelectorAll("ol[name=if]")[0], inst);
          self.generate(el.querySelectorAll("ol[name=if_do]")[0], inst);
          self.generate(el.querySelectorAll("ol[name=else]")[0], inst);
          var elems = el.querySelectorAll('.visible ol');
          for(var i = 0; i< elems.length; i++){
            if(elems[i].nodeName.toLowerCase() === 'ol'){
              self.generate(elems[i], inst);
            }
          }
        }else if(fn.type === 'parent'){
          var children = el.childNodes;
          for(var i = 0; i< children.length; i++){
            if(children[i].nodeName.toLowerCase() === 'ol'){
              self.generate(children[i], inst);
            }
          }
        }
      }
    });
  },
  functions:[
    {
      name:'if',
      type:'parent',
      content:[
        {input:'if_child', name:'if', label1:'When', label2:'Do', class:'visible'},
        {input:'if_child', name:'else_if0', label1:'When', label2:'Do', class:'hidden'},
        {input:'if_child', name:'else_if1', label1:'When', label2:'Do', class:'hidden'},
        {input:'if_child', name:'else_if2', label1:'When', label2:'Do', class:'hidden'},
        {input:'if_child', name:'else_if3', label1:'When', label2:'Do', class:'hidden'},
        {input:'if_child', name:'else_if4', label1:'When', label2:'Do', class:'hidden'},
        {input:'if_child', name:'else', label:'Else Do', class:'visible'},
        {input:'button', name:'remove', value:'&#9650;', onclick:'removeIfField();'},
        {input:'button', name:'add', value:'&#9660;', onclick:'addIfField();'}
      ],
      run: function(node, sumorobot, cb){
        //console.log(node.children);
        for(var j=0; j< node.children.length; j++){
          alert(node.children[j].name);
          //node.children[j].run();
        }
      }
    },
    {
      name:'repeat',
      type:'parent',
      content:[
        'Repeat',
        {input:'number', name:'count', default:2},
        'times'
      ],
      run: function(node, sumorobot, cb){
        for(var i=0; i< node.args().count; i++){
          for(var j=0; j< node.children.length; j++){
            node.children[j].run();
          }
        }
      }
    },
    {
      name:'move',
      type:'child',
      content:[
        'Move',
        {input:'option', name:'direction', default:'forward', values:['forward&#8593;', 'backward&#8595;', 'left&#8634;', 'right&#8635;']}
      ],
      run: function(node, sumorobot, cb){
        sumorobot.move(node.args().direction, node.args().distance, cb);
      }
    },
    {
      name:'enemy',
      type:'child',
      content:[
        'Enemy on the',
        {input:'option', name:'direction', default:'left', values:['left', 'right', 'front']}
      ],
      run: function(node, sumorobot, cb){
        sumorobot.turn(node.args().direction, node.args().angle, cb);
      }
    },
    {
      name:'line',
      type:'child',
      content:[
        'Line on the',
        {input:'option', name:'direction', default:'left', values:['left', 'right', 'front']}
      ],
      run: function(node, sumorobot, cb){
        sumorobot.turn(node.args().direction, node.args().angle, cb);
      }
    }
  ]
}

Builder.prototype.mainUI = '<div class="left container"><h2>Toolbox</h2>\
<ol class="functionList"></ol>\
<!--<div class="extra"><button id="follow">&#9654; Start Following Lines</button><button id="collide">&#9654; Start Collision Detection</button></div>-->\
</div>\
<div class="right container"><h2>Program</h2>\
<div class="programWrapper"><ol class="program" id="program">\
<li class="end func"><div class="hint">Drag functions from the left over here!</div></li></div>\
</ol>\
<div class="buttons"><button class="run">&#9654; Run</button><button class="pause" style="display:none;">&#10074;&#10074; Pause</button><button class="stop">&#9724; Stop</button><button class="clear">&#10006; Clear</button></div>\
</div>\
';