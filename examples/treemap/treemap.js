looker.plugins.visualizations.add({
  id: "treemap",
  label: "Treemap",
  options: {
    color_range: {
      type: "array",
      label: "Color Range",
      display: "colors",
      default: ["#dd3333", "#80ce5d", "#f78131", "#369dc1", "#c572d3", "#36c1b3", "#b57052", "#ed69af"],
    },
  },
  // require proper data input
  handleErrors: function(data, resp) {
    var min_mes, max_mes, min_dim, max_dim, min_piv, max_piv;
    min_mes = 1
    max_mes = 1
    min_dim = 1
    max_dim = undefined
    min_piv = 0
    max_piv = 0

    if (resp.fields.pivots.length > max_piv) {
      this.addError({
        group: "pivot-req",
        title: "Incompatible Data",
        message: "No pivot is allowed"
      });
      return false;
    } else {
      this.clearErrors("pivot-req");
    }

    if (resp.fields.pivots.length < min_piv) {
      this.addError({
        group: "pivot-req",
        title: "Incompatible Data",
        message: "Add a Pivot"
      });
      return false;
    } else {
      this.clearErrors("pivot-req");
    }

    if (max_dim && resp.fields.dimensions.length > max_dim) {
      this.addError({
        group: "dim-req",
        title: "Incompatible Data",
        message: "You need " + min_dim +" to "+ max_dim +" dimensions"
      });
      return false;
    } else {
      this.clearErrors("dim-req");
    }

    if (resp.fields.dimensions.length < min_dim) {
      this.addError({
        group: "dim-req",
        title: "Incompatible Data",
        message: "You need " + min_dim + max_dim ? " to "+ max_dim : "" +" dimensions"
      });
      return false;
    } else {
      this.clearErrors("dim-req");
    }

    if (max_mes && resp.fields.measure_like.length > max_mes) {
      this.addError({
        group: "mes-req",
        title: "Incompatible Data",
        message: "You need " + min_mes +" to "+ max_mes +" measures"
      });
      return false;
    } else {
      this.clearErrors("mes-req");
    }

    if (resp.fields.measure_like.length < min_mes) {
      this.addError({
        group: "mes-req",
        title: "Incompatible Data",
        message: "You need " + min_mes + max_mes ? " to "+ max_mes : "" +" measures"
      });
      return false;
    } else {
      this.clearErrors("mes-req");
    }

    // If no errors found, then return true
    return true;
  },
  // Set up the initial state of the visualization
  create: function(element, config) {
    var d3 = d3v4;

    this._svg = d3.select(element).append("svg");

  },
  // Render in response to the data or settings changing
  update: function(data, element, config, queryResponse) {
    if (!this.handleErrors(data, queryResponse)) return;
    var d3 = d3v4;

    var width = element.clientWidth;
    var height = element.clientHeight;

    var dimensions = queryResponse.fields.dimension_like;
    var measure = queryResponse.fields.measure_like[0];

    var format = formatType(measure.value_format);

    var color = d3.scaleOrdinal()
      .range(config.color_range)

    data.forEach(function(row) {
      row.taxonomy = dimensions.map(function(dim) {return row[dim.name].value})
    });

    var treemap = d3.treemap()
        .size([width, height-16])
        .tile(d3.treemapSquarify.ratio(1))
        .paddingOuter(1)
				.paddingTop(function(d) {
          return d.depth == 1 ? 16 : 0;
        })
        .paddingInner(1)
        .round(true);

    var svg = this._svg
      .html("")
      .attr("width", "100%")
      .attr("height", "100%")
      .append("g")
      .attr("transform", "translate(0,16)");

    var breadcrumb = svg.append("text")
      .attr("y", -5)
      .attr("x", 4);

    var root = d3.hierarchy(burrow(data))
      .sum(function(d) { return ("data" in d) ? d.data[measure.name].value : 0; });
    treemap(root);

    var cell = svg.selectAll(".node")
        .data(root.descendants())
      .enter().append("g")
        .attr("transform", function(d) { return "translate(" + d.x0 + "," + d.y0 + ")"; })
        .attr("class", function(d,i) { return "node depth-" + d.depth; })
        .style("stroke-width", 1.5)
        .style("cursor", "pointer")
        .on("click", function(d) { console.log(d);})
        .on("mouseenter", function(d) {
          var ancestors = d.ancestors();
          breadcrumb.text(ancestors.map(function(p) { return p.data.name }).slice(0,-1).reverse().join("-") + ": " + format(d.value));
          svg.selectAll("g.node rect")
            .style("stroke", null)
            .filter(function(p) {
              return ancestors.indexOf(p) > -1;
            })
            .style("stroke", function(p) {
              var scale = d3.scaleLinear()
                .domain([1,12])
                .range([color(d.ancestors().map(function(p) { return p.data.name }).slice(-2,-1)),"#ddd"])
              return "#fff";
            });
        })
        .on("mouseleave", function(d) {
          breadcrumb.text("");
          svg.selectAll("g.node rect")
            .style("stroke", function(d) {
              return null;
            })
        });

    cell.append("rect")
      .attr("id", function(d,i) { return "rect-" + i; })
      .attr("width", function(d) { return d.x1 - d.x0; })
      .attr("height", function(d) { return d.y1 - d.y0; })
      .style("fill", function(d) {
        if (d.depth == 0) return "none";
        var scale = d3.scaleLinear()
          .domain([1,6.5])
          .range([color(d.ancestors().map(function(p) { return p.data.name }).slice(-2,-1)),"#ddd"])
        return scale(d.depth);
      });

		cell.append("clipPath")
				.attr("id", function(d,i) { return "clip-" + i; })
			.append("use")
				.attr("xlink:href", function(d,i) { return "#rect-" + i; });

		var label = cell
        .append("text")
        .style("opacity", function(d) {
          if (d.depth == 1) return 1;
          return 0;
        })
				.attr("clip-path", function(d,i) { return "url(#clip-" + i + ")"; })
				.attr("y", function(d) {
          return d.depth == 1 ? "13" : "10";
        })
				.attr("x", 2)
				.style("font-family", "Helvetica, Arial, sans-serif")
        .style("fill", "white")
				.style("font-size", function(d) {
          return d.depth == 1 ? "14px" : "10px";
        })
				.text(function(d) { return d.data.name == "root" ? "" : d.data.name; });

    function burrow(table) {
      // create nested object
      var obj = {};
      table.forEach(function(row) {
        // start at root
        var layer = obj;

        // create children as nested objects
        row.taxonomy.forEach(function(key) {
          layer[key] = key in layer ? layer[key] : {};
          layer = layer[key];
        });
        layer.__data = row;
      });

      // recursively create children array
      var descend = function(obj, depth) {
        var arr = [];
        var depth = depth || 0;
        for (var k in obj) {
          if (k == "__data") { continue; }
          var child = {
            name: k,
            depth: depth,
            children: descend(obj[k], depth+1)
          };
          if ("__data" in obj[k]) {
            child.data = obj[k].__data;
          }
          arr.push(child);
        }
        return arr;
      };

      // use descend to create nested children arrys
      return {
        name: "root",
        children: descend(obj, 1),
        depth: 0
      }
    };

  }
});

