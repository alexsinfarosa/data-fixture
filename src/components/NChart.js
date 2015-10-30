import React, { PropTypes } from 'react';
import d3 from 'd3';
import ReactFauxDOM from 'react-faux-dom';

import {seasons,elems} from '../api';
import styles from './App.css';


export default class AreaChart {

  static propTypes = {
    meta: PropTypes.object,
    geomType: PropTypes.string.isRequired,
    sid: PropTypes.string.isRequired,
    element: PropTypes.string.isRequired,
    season: PropTypes.string.isRequired,
    result: PropTypes.object.isRequired,
    ready: PropTypes.bool.isRequired
  };

  render() {
    const { meta, geomType, sid, element, season, result, ready } = this.props;
    const width = 600, height = 400, margin = {top: 10, right: 15, bottom: 50, left: 50};

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

    const data = new Map(), xRange=[9999,0], yRange=[10000,-10000];
    const dPrism = [], sdPrism = [], dHist = [], dProj = [], medians = [0,0];
    if (ready && result.proj) {
      let cnt = 0, sum = [0.,0.,0.], tsum = 0., proj = false, oVal;
      result.proj.forEach((d) => {
        const yr = +d[0].slice(0,4), v = d[1][sid].map(x => +x.toFixed(2)), datum = {};
        if (yr < xRange[0]) xRange[0] = yr;
        if (yr > xRange[1]) xRange[1] = yr;
        if (v[0] < yRange[0]) yRange[0] = v[0];
        if (v[2] > yRange[1]) yRange[1] = v[2];

        if (yr > 2020 && !proj) { // reset the counters
          medians[0] = tsum / cnt;
          cnt = 0; sum = [0.,0.,0.]; tsum = 0.; proj = true;
        }
        tsum += v[1]; cnt++;
        datum.proj = v;
        oVal = cnt > 5 ? data.get(yr-5).proj : [0,0,0];
        v.forEach((x,i) => {sum[i] += x - oVal[i];});
        if (cnt >= 5) {
          const s = v.map((x,i) => sum[i]/5.);
          if (proj) dProj.push([yr, ...s])
          else dHist.push([yr, ...s]);
          datum.sproj = s;
        }
        data.set(yr,datum);
      })
      medians[1] = tsum/cnt;
    }

    if (ready && result.data) {
      let cnt = 0, sum = 0., oVal;
      result.data.forEach((d) => {
        const yr = +d[0].slice(0,4), datum = {};
        let v = d[1][sid];
        if (typeof v != 'undefined' && v == v) {
          v = +v.toFixed(2);
          if (yr < xRange[0]) xRange[0] = yr;
          if (yr > xRange[1]) xRange[1] = yr;
          if (v < yRange[0]) yRange[0] = v;
          if (v > yRange[1]) yRange[1] = v;

          cnt++;
          datum.data = v;
          oVal = cnt > 5 ? data.get(yr-5).data : 0.;
          sum += v - oVal;
          dPrism.push([yr,v]);
          if (cnt >= 5) {
            const s = sum/5;
            sdPrism.push([yr,s]);
            datum.sdata = s;
          }
          if (data.has(yr)) data.set(yr,{...data.get(yr), ...datum})
          else data.set(yr,datum);
        }
      })
    }

    if (dPrism.length > 5){
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

      const areaLo = d3.svg.area()
        .x (d => x(d[0]))
        .y0(d => y(d[1]))
        .y1(d => y(d[2]))
      const areaHi = d3.svg.area()
        .x (d => x(d[0]))
        .y0(d => y(d[2]))
        .y1(d => y(d[3]))
      const line = d3.svg.line()
        .x(d => x(d[0]))
        .y(d => y(d[1]))

      const node = ReactFauxDOM.createElement('svg'),
        svg = d3.select(node)
          .attr('width', width)
          .attr('height', height)
          .append('g')
          .attr('transform', 'translate(' + margin.left + ',' + margin.top +')')

      svg.append('g')
        .attr('class', styles.axis)
        .attr('transform', 'translate(0,' + (height - margin.top - margin.bottom) + ')')
        .call(xAxis)
        .append("text")
          .attr("class", styles.axisLabel)
          .attr("x", width - margin.left - margin.right)
          .attr("y", -6)
          .style("text-anchor", "end")
          .text("Year");

      svg.append('g')
        .attr('class', styles.axis)
        .call(yAxis)
        .append("text")
          .attr("class", styles.axisLabel)
          .attr("transform", "rotate(-90)")
          .attr("y", 6)
          .attr("dy", "0.7em")
          .style("text-anchor", "end")
          .text(yLabel);

      svg.append('path')
        .datum(dHist)
        .attr('class', styles.areaLo)
        .attr('d', areaLo)
      svg.append('path')
        .datum(dHist)
        .attr('class', styles.areaHi)
        .attr('d', areaHi)

      svg.append('path')
        .datum(dProj)
        .attr('class', styles.areaLo)
        .attr('d', areaLo)
      svg.append('path')
        .datum(dProj)
        .attr('class', styles.areaHi)
        .attr('d', areaHi)

      svg.append('path')
        .datum(sdPrism)
        .attr('class', styles.prismLine)
        .attr('d', line)

      const dots = svg.append('g');
      dPrism.forEach((d)=>{
        dots.append('circle')
          .attr('class',styles.prismDots)
          .attr('r',2)
          .attr('cx',x(d[0]))
          .attr('cy',y(d[1]))
      })

      chart = node.toReact()
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

    return <div>
      <h3 style={{textAlign: 'center'}}>{titleSeason + ' ' + titleElem}</h3>
      <h4 style={{textAlign: 'center'}}>{stationName}</h4>
      {chart}
      </div>
  }
};
