import React, { PropTypes } from 'react';
import d3 from 'd3';
import ReactFauxDOM from 'react-faux-dom';

import {seasons,elems} from '../api';
import DownloadForm from './DownloadForm'
import styles from './App.css';


export default class StationChart extends React.Component {

  static propTypes = {
    meta: PropTypes.object,
    geomType: PropTypes.string.isRequired,
    sid: PropTypes.string.isRequired,
    element: PropTypes.string.isRequired,
    season: PropTypes.string.isRequired,
    result: PropTypes.object.isRequired,
    showInfo: PropTypes.func.isRequired,
    year: PropTypes.number.isRequired,
    setYear: PropTypes.func.isRequired,
    ready: PropTypes.bool.isRequired
  };

  constructor(props) {
    super(props);
    this.data = new Map();
    this.result = null;
  }

  summarizeData(result) {
    /*
    data consists of map[yr] {
      obs:                 value
      obs_avg:             value
    }
    plus entries for plotting (yr, v1, v2, v3...):
      obs
      obs_avg
      xrange
      yrange
    */
    const data = new Map();
    const xRange=[9999,0], yRange=[10000,-10000];
    this.data = data;
    this.result = result;

    // calculate station obs data
    if (result.data) {
      let cnt = 0, sum = 0., oVal;
      const obs = [];

      result.data.forEach((d) => {
        const yr = +d[0].slice(0,4);

        if (d[1] != 'M') {
          const idx = obs.length,
            v = 0.0 ? d[1] == 'T' : +(+d[1]).toFixed(2);

          // get data range          
          if (yr < xRange[0]) xRange[0] = yr;
          if (yr > xRange[1]) xRange[1] = yr;
          if (v < yRange[0]) yRange[0] = v;
          if (v > yRange[1]) yRange[1] = v;

          if (idx >= 4 && obs[idx-4][0] == yr-4) {
            let mean = v;
            obs.slice(idx-4,idx).forEach((d) => {mean += d[1];});
            mean = +(mean/5.).toFixed(2);
            obs.push([yr,v,mean]);
            data.set(yr,{obs:v, obs_avg: mean});
          } else {
            obs.push([yr,v]);
            data.set(yr,{obs:v});
          }
        }
      })
      data.set("obs",obs);
    }

    if (yRange[0]!=10000) {
      data.set("xrange",xRange);
      data.set("yrange",yRange);
      const rows = [];
      for (let yr=xRange[0]; yr<=xRange[1]; yr++) {
        if (data.has(yr)) {
          const datum = data.get(yr);
          if (typeof datum.obs != "undefined") {
            rows.push(""+yr+","+datum.obs);
          }
        }
      }
      if (rows.length > 0) data.set("rows",rows);
    }
  }

  render() {
    const { meta, geomType, sid, element, season, result, year, ready } = this.props;
    const width = 500, height = 400, margin = {top: 10, right: 15, bottom: 30, left: 50};

    const { label:titleElem, yLabel, ttUnits } = elems.get(element),
          titleSeason = seasons.get(season).title,
          stationName = meta && meta.has(sid) ? meta.get(sid).name : 'loading';
    let chart = <svg width={width} height={height} >
                  <text x="50%" y="50%"
                    alignmentBaseline="middle"
                    textAnchor="middle"
                    fontSize="150%">
                    Loading…
                  </text>
                </svg>;

    if ( ready && this.result != result) this.summarizeData(result);

    const data = this.data;

    if (data.has("xrange")) {
      const xRange = data.get("xrange"), yRange = data.get("yrange");

      const x = d3.scale.linear()
        .range([0, width - margin.left - margin.right])
        .domain([xRange[0]-2,xRange[1]]);
      const y = d3.scale.linear()
        .range([height - margin.top - margin.bottom, 0])
        .domain(yRange)
        .nice(5);

      const xAxis = d3.svg.axis()
        .scale(x)
        .tickFormat(d3.format(".0f"))
        .orient('bottom');
      const yAxis = d3.svg.axis()
        .scale(y)
        .orient('left');

      const line = d3.svg.line()
        .defined( function (d) {
          return d.length == 3;
        })
        .x(d => x(d[0]))
        .y(d => y(d[2]))
      const yrline = d3.svg.line()
        .x(d => x(d[0]))
        .y(d => y(d[1]))

      const node = ReactFauxDOM.createElement("svg"),
        svg = d3.select(node)
          .attr("width", width)
          .attr("height", height)
          .append("g")
          .attr("transform", "translate(" + margin.left + "," + margin.top +")")

      // add rect for mouse capture on webkit
      svg.append("rect")
        .style("opacity","0")
        .attr("x",0)
        .attr("y",0)
        .attr("width", width-margin.left-margin.right)
        .attr("height", height-margin.top-margin.bottom);

      svg.append("g")
        .attr("class", styles.axis)
        .attr("transform", "translate(0," + (height - margin.top - margin.bottom) + ")")
        .call(xAxis)
        .append("text")
          .attr("class", styles.axisLabel)
          .attr("x", width - margin.left - margin.right)
          .attr("y", -6)
          .style("text-anchor", "end")
          .text("Year");

      svg.append("g")
        .attr("class", styles.axis)
        .call(yAxis)
        .append("text")
          .attr("class", styles.axisLabel)
          .attr("transform", "rotate(-90)")
          .attr("y", 6)
          .attr("dy", "0.7em")
          .style("text-anchor", "end")
          .text(yLabel);

      if (data.has(year)) {
        svg.append("path")
          .datum([
            [year,yRange[0]],
            [year,yRange[1]],
          ])
          .attr("class", styles.highlight)
          .attr("d",yrline)
      }

      const obs = data.get("obs");
      svg.append("path")
        .datum(obs)
        .attr("class", styles.prismLine)
        .attr("d", line)

      const dots = svg.append('g');
      obs.forEach((d)=>{
        dots.append('circle')
          .attr('class', d[0]!= year ? styles.prismDots : styles.prismDotsOver)
          .attr('r',2)
          .attr('cx',x(d[0]))
          .attr('cy',y(d[1]))
      });
      

      d3.select(node)
        .on("mouseleave",() => {
          this.props.setYear(0);
        })
        .on("mousemove", (d,i)=>{
          const e = d3.event;
          let year = 0;
          if (e.srcElement) { // non-firefox
            if (e.srcElement.nodeName != "text") { // range label
              year = +x.invert(e.offsetX - margin.left).toFixed(0);
            }
          } else {
            if (e.explicitOriginalTarget && e.target.nodeName != "text") {
              year = +x.invert(d3.mouse(e.explicitOriginalTarget)[0]).toFixed(0);
            }
          }
          if (this.data.has(year)) {
            const d = this.data.get(year);
            if (typeof d.obs == "undefined" && typeof d.model_avg == "undefined") year = 0;
          } else year = 0;
          this.props.setYear(year);
        })

      chart = node.toReact();

    } else if (ready) {
      chart = <svg width={width} height={height} >
      <text x="50%" y="50%"
        alignmentBaseline="middle"
        textAnchor="middle"
        fontSize="200%">
        Insufficient Data Coverage
        </text>
      </svg>;
    }

    let dload = ""
    if (data.has("rows")) {
      dload = <DownloadForm ref={(c) => this.download = c} title={["year","obs"]} rows={data.get("rows")} />
    }
    return <div className={styles.chartOutput}>
      <div className={styles.chartBody}>
      <div className={styles.chartHeader1}>{titleSeason + ' ' + titleElem}</div>
      <div className={styles.chartHeader2}>{stationName}</div>
      {chart}
      {dload}
      </div>
      <Info year={year} element={element} data={data.has(year) ? data.get(year) : {}}
        download={::this.doDownload}
        showInfo={this.props.showInfo}/>
      </div>
  }

  doDownload(e) {
    const f = this.download;
    if (typeof f != "undefined") {
      f._form.submit();
    }
  }
};

class Info extends React.Component {

  static propTypes = {
    year: PropTypes.number.isRequired,
    element: PropTypes.string.isRequired,
    // data: PropTypes.object.isRequired,
  };

  render () {
    const {year,element,data,download} = this.props,
      { ttUnits } = elems.get(element);
    let obsYr=" ", obsYrRng=" ", obs=" ", obs_avg=" ";

    if (typeof data.obs != "undefined") {
      obsYr = ""+year;
      obs = ""+data.obs;
    }
    if (typeof data.obs_avg != "undefined") {
      obsYrRng = ""+(year-4)+"–"+year;
      obs_avg = ""+data.obs_avg;
    }
    const col1=styles.col1, col2=styles.col2, col3=styles.col3,
      l_avg = <svg width="20" height="20"><path className={styles.prismLine} d="M0,15L5,12L10,7,L15,10L20,5"></path></svg>,
      l_obs = <svg width="20" height="20"><circle className={styles.prismDots} r="2" cx="10" cy="10"></circle></svg>;

    return <div className={styles.chartTable} >
      <button onClick={download}>Download</button>
      <table>
      <thead>
      <tr><th colSpan="3">Observed {ttUnits}</th></tr>
      </thead>
      <tbody>
      <tr>
        <td className={col1}>{obsYr}</td>
        <td className={col2}>{obs}</td>
        <td className={col3}>{l_obs}</td>
      </tr>
      <tr>
        <td className={col1}>5-yr Mean</td>
        <td className={col2} rowSpan="2">{obs_avg}</td>
        <td className={col3} rowSpan="2">{l_avg}</td>
      </tr>
      <tr>
        <td className={col1}>{obsYrRng}</td>
      </tr>
      </tbody>
      </table>
      <button onClick={this.props.showInfo}>About the Source Data</button>
      <a href="http://www.nrcc.cornell.edu"><img src="data/images/acis_logo.png"/></a>
    </div>
  }
}
