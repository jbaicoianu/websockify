class PPPUserGraph extends HTMLElement {
  connectedCallback() {
    console.log('create graph');
    this.serverstats = document.createElement('pppusers-server-stats');
    this.appendChild(this.serverstats);
    this.createGraph();
  }
  createGraph() {
    // set the dimensions and margins of the graph
    var margin = {top: 60, right: 100, bottom: 150, left: 150},
        width = window.innerWidth - margin.left - margin.right,
        height = window.innerHeight - margin.top - margin.bottom;

    // append the svg object to the body of the page
    var svg = d3.select(this)
      .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform",
              "translate(" + margin.left + "," + margin.top + ")");
    this.svg = svg;
    this.width = width;
    this.height = height;
    this.margin = margin;

    this.createTimeframeButtons();
    this.timeframe = 60 * 60 * 12; // default to last 12 hours
    this.updateGraph();
    setInterval(() => this.updateGraph(), 10000);
    //setTimeout(() => location.reload(), 30000);
  }
  updateGraph() {
    let svg = this.svg,
        width = this.width,
        height = this.height;
    d3.csv("/trafficlog?chunks=250&begin=" + ((Date.now() / 1000) - (this.timeframe)), (data) => {
      // List of groups = header of the csv files
      var keys = data.columns.slice(1)
      console.log('my data', data);

      // color palette
      var color = d3.scaleOrdinal()
        .domain(keys)
        .range(d3.schemeSet2);

      //stack the data?
      var stackedData = d3.stack()
        .keys(keys)
        (data)

      //////////
      // AXIS //
      //////////

      // Add X axis
      var x = d3.scaleLinear()
        .domain(d3.extent(data, function(d) { return d.time * 1000; }))
        .range([ 0, width ]);
      var xAxis = this.xAxis;
      if (!xAxis) {
        xAxis = this.xAxis = svg.append("g")
          .attr("transform", "translate(0," + height + ")")

        // Add X axis label:
        svg.append("text")
            .attr("text-anchor", "end")
            .attr("x", width)
            .attr("y", height+40 )
            .text("Time");

        // Add Y axis label:
        svg.append("text")
            .attr("text-anchor", "end")
            .attr("x", 0)
            .attr("y", -20 )
            .text("Usage")
            .attr("text-anchor", "start")
      }
      xAxis.call(
            d3.axisBottom(x)
            .ticks(5)
            .tickFormat(d3.timeFormat("%d %b %H:%M:%S"))
          );

      let scalemax = d3.max(data, f => {let sum = 0, keys = Object.keys(f); keys.shift(); for (let k of keys) { sum += +f[k]; }; return sum});

      // Add Y axis
      var y = d3.scaleLinear()
        .domain([0, scalemax])
        .range([ height, 0 ]);
      if (!this.yAxis) {
        this.yAxis = svg.append("g")
      }
      this.yAxis.call(d3.axisLeft(y).ticks(5).tickFormat(this.formatBytes))



      //////////
      // BRUSHING AND CHART //
      //////////

      // Add a clipPath: everything out of this area won't be drawn.
      var clip = this.clip;
      if (!clip) {
        clip = this.clip = svg.append("defs").append("svg:clipPath")
          .attr("id", "clip")
          .append("svg:rect")
          .attr("width", width )
          .attr("height", height )
          .attr("x", 0)
          .attr("y", 0);

      }
      // add brushing
      var brush = d3.brush()                 // add the brush feature using the d3.brush function
          .extent( [ [0,0], [width,height] ] ) // initialise the brush area: start at 0,0 and finishes at width,height: it means i select the whole graph area
          .on("end", updateChart) // Each time the brush selection changes, trigger the 'updateChart' function
      // Create the scatter variable: where both the circles and the brush take place
      var areaChart = this.areaChart;
      if (!areaChart) {
        areaChart = this.areaChart = svg.append('g')
          .attr("clip-path", "url(#clip)")
        // Add the brushing
        areaChart
          .append("g")
            .attr("class", "brush")
            .call(brush);
      }

      // Area generator
      var area = d3.area()
        .x(function(d) { return x(d.data.time * 1000); })
        .y0(function(d) { return y(d[0]); })
        .y1(function(d) { return y(d[1]); })

      // Show the areas
      let areaUpdate = areaChart
            .selectAll(".myArea")
            .data(stackedData)
      let areaEnter = areaUpdate
        .enter()
        .append("path")
          .attr("class", (d) => { return "myArea " + this.sanitizeSelector(d.key) })
          .style("fill", function(d) { return color(d.key); })
      areaUpdate
          .exit()
          .remove()
      areaEnter.merge(areaUpdate)
          .attr("class", (d) => { return "myArea " + this.sanitizeSelector(d.key) })
          .attr("d", area)


      var idleTimeout
      function idled() { idleTimeout = null; }

      // A function that update the chart for given boundaries
      function updateChart() {

        let extent = d3.event.selection

        // If no selection, back to initial coordinate. Otherwise, update X axis domain
        if(!extent){
          if (!idleTimeout) return idleTimeout = setTimeout(idled, 350); // This allows to wait a little bit
          x.domain(d3.extent(data, function(d) { return d.time * 1000; }))
        }else{
          x.domain([ x.invert(extent[0]), x.invert(extent[1]) ])
          areaChart.select(".brush").call(brush.move, null) // This remove the grey brush area as soon as the selection has been done
        }

        // Update axis and area position
        xAxis.transition().duration(1000).call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%d %b %H:%M:%S")))
        areaChart
          .selectAll("path")
          .transition().duration(1000)
          .attr("d", area)
        }



        //////////
        // HIGHLIGHT GROUP //
        //////////




      //////////
      // LEGEND //
      //////////

      // Add one dot in the legend for each name.
      var size = 20
      let legendUpdate = svg.selectAll("rect.labelkey")
        .data(keys)

      legendUpdate.enter()
        .append("rect")
          .attr("class", d => 'labelkey ' + this.sanitizeSelector(d))
          .attr("x", width * .9)
          .attr("y", function(d,i){ return 10 + i*(size+5)}) // 100 is where the first dot appears. 25 is the distance between dots
          .attr("width", size)
          .attr("height", size)
          .style("fill", function(d){ return color(d)})
          .on("mouseover", this.highlight.bind(this))
          .on("mouseleave", this.noHighlight.bind(this))
      legendUpdate.exit()
        .remove()


      // Add one dot in the legend for each name.
      let legendLabelUpdate = svg.selectAll("text.label")
        .data(keys)
      let legendEnter = legendLabelUpdate.enter()
        .append("text")
          .attr("x", width * .9 + size*1.2)
          .attr("y", function(d,i){ return 10 + i*(size+5) + (size/2)}) // 100 is where the first dot appears. 25 is the distance between dots
          .attr('class', d => 'label ' + this.sanitizeSelector(d))
          .style("fill", function(d){ return color(d)})
          .text(function(d){ return d})
          .attr("text-anchor", "left")
          .style("alignment-baseline", "middle")
          .on("mouseover", this.highlight.bind(this))
          .on("mouseleave", this.noHighlight.bind(this))
          //.on("click", ev => this.showAddressPopup(ev))
      legendLabelUpdate.exit()
        .remove()
      legendEnter.merge(legendLabelUpdate)
          .style("fill", function(d){ return color(d)})
          .attr('class', d => 'label ' + this.sanitizeSelector(d))
          .text(d => d);
    })

  }
  sanitizeSelector(d) {
    return 'x' + d.replaceAll('.', '_').replaceAll(':', '_')
  }
    // What to do when one group is hovered
  highlight(d) {
    let classname = this.sanitizeSelector(d)
    // reduce opacity of all groups
    d3.selectAll(".myArea").style("opacity", .2)
    // expect the one that is hovered
    d3.select("."+classname).style("opacity", 1)
    this.showAddressPopup(d);
  }

  // And when it is not hovered anymore
  noHighlight(d) {
    d3.selectAll(".myArea").style("opacity", 1)
  }
  formatBytes(d) {
    const byteLabels = ['B', 'KB', 'MB', 'GB', 'TB'];
    let label = byteLabels[0];
    for (let i = 1; i < byteLabels.length; i++) {
      if (d > 1024) {
        label = byteLabels[i];
        d /= 1024;
      }
    }
    return d.toFixed(2) + ' ' + label;
  }
  showAddressPopup(addr) {
    if (!this.popup) {
      this.popup = document.createElement('pppusers-popup');
    }
    if (!this.popup.parentNode) {
      document.body.appendChild(this.popup);
    }
    let el = document.querySelector('.label.' + this.sanitizeSelector(addr));
    console.log('blip', addr, el);
    this.popup.show(el, addr);
  }
  hideAddressPopup() {
    if (this.popup && this.popup.parentNode) {
      this.popup.parentNode.removeChild(this.popup);
    }
  }
  createTimeframeButtons() {
    let selector = document.createElement('pppusers-graph-timeframeselector')
    this.appendChild(selector);
    setTimeout(() => selector.select('past 12h'), 0);
    selector.addEventListener('timeframechange', ev => {
      if (this.timeframe != ev.detail) {
        this.timeframe = ev.detail;
        this.updateGraph();
      }
    });
  }
}
class PPPUserGraphTimeframeSelector extends HTMLElement {
  constructor() {
    super();
    this.timeframes = {
      'past month': 60 * 60 * 24 * 31,
      'past week': 60 * 60 * 24 * 7,
      'past day': 60 * 60 * 24,
      'past 12h': 60 * 60 * 12,
      'past 6h': 60 * 60 * 6,
      'past 1h': 60 * 60,
      'past 30m': 60 * 30
    };
  }
  connectedCallback() {
    if (!this.buttons) {
      this.buttons = {};
      for (let k in this.timeframes) {
        let button = document.createElement('button');
        button.innerText = k;
        button.addEventListener('click', ev => this.select(k));
        this.appendChild(button);
        this.buttons[k] = button;
      }
    }
  }
  select(selected) {
    for (let k in this.buttons) {
      if (k == selected) {
        this.buttons[k].classList.add('selected');
      } else {
        this.buttons[k].classList.remove('selected');
      }
    }
    this.dispatchEvent(new CustomEvent('timeframechange', { detail: this.timeframes[selected] }));
  }
}
class PPPUserPopup extends HTMLElement {
  connectedCallback() {
    if (!this.banbutton) {
      let banbutton = this.banbutton =  document.createElement('button');
      banbutton.addEventListener('click', ev => this.handleBanClick(ev));
      banbutton.innerText = 'Ban IP';
      this.appendChild(banbutton);
      this.style.position = 'absolute';
      this.style.zIndex = 100;
    }
  }
  show(parent, addr) {
    this.currentaddr = addr;
    if (parent) {
      let pos = parent.getBoundingClientRect();

console.log('show it', pos, parent);
      this.style.top = (pos.y + document.body.scrollTop) + 'px';
      this.style.left = (pos.x + pos.width + 10) + 'px';
    }
  }
  handleBanClick(ev) {
    fetch('/ban', { method: 'POST', body: JSON.stringify({host: this.currentaddr}) });
  }
}
class PPPUserServerStats extends HTMLElement {
  connectedCallback() {
    this.refreshStats();
    setInterval(() => this.refreshStats(), 15000);
  }
  async refreshStats() {
    let res = await fetch('/serverstats');
    let stats = await res.json();
    this.innerHTML = `<span>Active users: ${stats.activeusers}</span><span>Load Avg: ${stats.load[0].toFixed(1)}</span><span>Memory: ${stats.memory.percent}% used</span>`
  }
}
customElements.define('pppusers-graph', PPPUserGraph);
customElements.define('pppusers-graph-timeframeselector', PPPUserGraphTimeframeSelector);
customElements.define('pppusers-popup', PPPUserPopup);
customElements.define('pppusers-server-stats', PPPUserServerStats);

