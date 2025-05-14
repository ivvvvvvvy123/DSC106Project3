// ---------- CONSTANTS ---------------------------------------------------
const CYCLE = 720;                    // 12 h in minutes
const W = 960, H = 420,
      M = {top:20,right:20,bottom:40,left:50},
      IW = W-M.left-M.right,
      IH = H-M.top-M.bottom,
      ROW = IH/2 - 20;
const COLORS = {f:'#d1495b', m:'#006d77', light:'rgba(255,240,120,.35)', dark:'rgba(0,0,0,.12)', estrus:'rgba(233,30,99,.28)'};
const ESTRUS_START = 1440, ESTRUS_PERIOD = 5760;

let activityData, tempData;   // global for linked scatter

// ---------- LOAD --------------------------------------------------------
Promise.all([
  d3.csv('Fem_Act.csv'), d3.csv('Male_Act.csv'),
  d3.csv('Fem_Temp.csv'), d3.csv('Male_Temp.csv')
]).then(([fAct,mAct,fTemp,mTemp])=>{
  activityData = merge(fAct,mAct);
  tempData     = merge(fTemp,mTemp);
  drawPanel('#activity', activityData, 'Activity (counts)');
  drawPanel('#temp',     tempData,    'Temperature (°C)');
});

function merge(fCsv,mCsv){
  return fCsv.map((row,i)=>({
    minute:i,
    female:avg(row),
    male:  avg(mCsv[i])
  }));
}
function avg(obj){let s=0,c=0;for(const k in obj){const v=+obj[k];if(!isNaN(v)){s+=v;c++;}}return s/c;}

// ---------- DRAW PANEL --------------------------------------------------
function drawPanel(sel,data,yLabel){
  const id = sel.slice(1);
  const svg = d3.select(sel)
    .attr('width', '100%')
    .attr('height', H)
    .attr('viewBox', `0 0 ${W} ${H}`);
  const g   = svg.append('g').attr('transform',`translate(${M.left},${M.top})`);

  // scales
  const isTemp = yLabel.includes('Temp');
  const pad = isTemp?0.5:0;
  const x = d3.scaleLinear().domain(d3.extent(data,d=>d.minute)).range([0,IW]);
  const yF = d3.scaleLinear().domain(isTemp?[d3.min(data,d=>d.female)-pad,d3.max(data,d=>d.female)+pad]:[0,d3.max(data,d=>d.female)]).nice().range([ROW,0]);
  const yM = d3.scaleLinear().domain(isTemp?[d3.min(data,d=>d.male)-pad,d3.max(data,d=>d.male)+pad]:[0,d3.max(data,d=>d.male)]).nice().range([ROW,0]);
  
  let currentTransform = d3.zoomIdentity;
  // highlight group
  const hl = g.append('g');
  highlight('light');
  function highlight(mode){
    hl.selectAll('rect').remove();
    const max = data[data.length-1].minute;
  
    // ★ 用当前 transform 生成一个 zoom-aware 的 x 轴刻度
    const zx = currentTransform.rescaleX(x);
  
    if(mode === 'estrus'){
      for(let s = ESTRUS_START; s <= max; s += ESTRUS_PERIOD){
        hl.append('rect')
          .attr('data-start', s)
          .attr('data-span', 1440)
          // ← 用 zx 而非原始 x
          .attr('x',      zx(s))
          .attr('y',      0)
          .attr('width',  zx(s + 1440) - zx(s))
          .attr('height', ROW)
          .attr('fill',   COLORS.estrus);
      }
    } else {
      const fill = mode==='light'?COLORS.light:COLORS.dark;
      const off  = mode==='light'?CYCLE:0;
      for(let s = off; s <= max; s += CYCLE*2){
        hl.append('rect')
          .attr('data-start', s)
          .attr('data-span',  CYCLE)
          .attr('x',          zx(s))
          .attr('y',          0)
          .attr('width',      zx(s + CYCLE) - zx(s))
          .attr('height',     IH)
          .attr('fill',       fill);
      }
    }
  }
  
  // female row
  const fGrp = g.append('g');
  fGrp.append('path').datum(data).attr('fill','none').attr('stroke',COLORS.f).attr('stroke-width',1.2).attr('d',d3.line().x(d=>x(d.minute)).y(d=>yF(d.female)));
  fGrp.append('g').call(d3.axisLeft(yF).ticks(4));
  fGrp.append('text').attr('x',IW/2).attr('y',12).attr('text-anchor','middle').attr('font-weight',600).text('Female (mean across mice)');

  // male row
  const mOff = ROW+40;
  const mGrp = g.append('g').attr('transform',`translate(0,${mOff})`);
  mGrp.append('path').datum(data).attr('fill','none').attr('stroke',COLORS.m).attr('stroke-width',1.2).attr('d',d3.line().x(d=>x(d.minute)).y(d=>yM(d.male)));
  mGrp.append('g').call(d3.axisLeft(yM).ticks(4));
  mGrp.append('text').attr('x',IW/2).attr('y',12).attr('text-anchor','middle').attr('font-weight',600).text('Male (mean across mice)');

  // x-axis
  const xAxis = g.append('g').attr('transform',`translate(0,${IH})`).call(d3.axisBottom(x).ticks(10));
  xAxis.append('text').attr('x',IW/2).attr('y',32).attr('fill','#000').attr('text-anchor','middle').text('Minutes (0 = start)');
  // Independent Scale Toggle Logic for Each Panel
document.querySelectorAll('.scale-controls').forEach(scaleGroup => {
  const targetPanel = scaleGroup.dataset.target;
  const panel = d3.select(`#${targetPanel}`);
  const xAxis = panel.select('.x-axis');
  const xAxisLabel = panel.select('.x-axis-label');
  const femalePath = panel.select('.female-path');
  const malePath = panel.select('.male-path');

  scaleGroup.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('click', e => {
          // Set active button within this group
          scaleGroup.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');

          // Update the x-axis scale
          const scale = e.target.dataset.scale;
          const x = scale === 'days'
              ? d3.scaleLinear().domain([0, 14]).range([0, IW])
              : d3.scaleLinear().domain([0, 20160]).range([0, IW]);

          // Update the x-axis ticks and labels
          xAxis.call(d3.axisBottom(x).ticks(scale === 'days' ? 14 : 20).tickFormat(d => 
              scale === 'days' ? `Day ${d + 1}` : d.toLocaleString()
          ));
          xAxisLabel.text(scale === 'days' ? 'Days (1-14)' : 'Minutes (0 = start)');

          // Update the paths for female and male
          femalePath.attr('d', d3.line()
              .x(d => x(scale === 'days' ? d.minute / 1440 : d.minute))
              .y(d => d.female)
          );
          malePath.attr('d', d3.line()
              .x(d => x(scale === 'days' ? d.minute / 1440 : d.minute))
              .y(d => d.male)
          );
      });
  });
});

  
  // zoom
  
  svg.call(d3.zoom()
  .scaleExtent([1,20])
  .translateExtent([[0,0],[IW,IH]])
  .on('zoom', ev=>{
      currentTransform = ev.transform; 
      const zx = ev.transform.rescaleX(x);
      xAxis.call(d3.axisBottom(zx).ticks(10));
      fGrp.select('path').attr('d', d3.line().x(d=>zx(d.minute)).y(d=>yF(d.female)));
      mGrp.select('path').attr('d', d3.line().x(d=>zx(d.minute)).y(d=>yM(d.male)));
      hl.selectAll('rect')
        .attr('x', function(){
          const s = +this.dataset.start || +this.getAttribute('x');
          return zx(s);
        })
        .attr('width', function(){
          const s = +this.dataset.start || +this.getAttribute('x');
          return zx(s + CYCLE) - zx(s);
        });
    })
    ).on('dblclick.zoom',null);
  

  // tooltip & hover
  // ── tooltip vertical bar ───────────────────────────────────────────
const tooltip = d3.select('#tooltip');

const vLine = g.append('line')
    .attr('stroke', '#555')
    .attr('stroke-width', 1)
    .attr('y1', 0)
    .attr('y2', IH)
    .style('display', 'none');

const bisect = d3.bisector(d => d.minute).left;

const overlay = g.append('rect')
    .attr('width', IW)
    .attr('height', IH)
    .attr('fill', 'none')
    .attr('pointer-events', 'all')
    .on('mousemove', handleMove)
    .on('mouseout', () => {
        vLine.style('display', 'none');
        tooltip.style('display', 'none');
    })
    .on('click', event => {
        if (!(event.ctrlKey || event.metaKey)) return;               // ctrl-click ⇒ scatter
        const [mx] = d3.pointer(event, overlay.node());
        const min  = Math.round(x.invert(mx));
        const sex  = (d3.pointer(event, overlay.node())[1] < ROW) ? 'Female' : 'Male';
        showScatter(min - 360, min + 360, sex);
    });

  function handleMove(event) {
      const [mx] = d3.pointer(event, overlay.node());
      const minute = Math.round(x.invert(mx));
      const i = Math.max(0, Math.min(data.length - 1, bisect(data, minute)));
      const d = data[i];

      vLine.attr('x1', x(minute)).attr('x2', x(minute)).style('display', null);
      tooltip
          .style('display', 'block')
          .html(`<b>Minute:</b> ${minute}<br>
                 <span style='color:${COLORS.f}'>♀ ${d.female.toFixed(1)}</span><br>
                 <span style='color:${COLORS.m}'>♂ ${d.male.toFixed(1)}</span>`)
          .style('left', event.pageX + 12 + 'px')
          .style('top',  event.pageY + 12 + 'px');
  }

  // ── mode-toggle buttons ────────────────────────────────────────────
document.querySelectorAll(`button[data-target='${id}']`)
    .forEach(btn =>
        btn.addEventListener('click', e => {
            document.querySelectorAll(`button[data-target='${id}']`)
                    .forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            highlight(e.target.dataset.mode);     // Light / Dark / Estrus
        }));
}
/* ───────────────── showScatter helper ───────────────────────────── */
function showScatter(minStart, minEnd, sex){
  const dlg   = document.getElementById('scatterDlg');
  const svg   = d3.select('#scatterDlg svg');
  svg.selectAll('*').remove();                 // clear previous plot

  // slice global arrays
  const slice = d3.range(Math.max(0,minStart), Math.min(activityData.length, minEnd))
                  .map(i => ({
                    activity : activityData[i].female,   // mean across females
                    temp     : tempData[i].female,       // mean across females
                    phase    : (i % (CYCLE*2) < CYCLE) ? 'dark' : 'light'
                  }));
    // Add scatter legends
    d3.select('#scatter-title')
        .text(`Temperature vs Activity (12-h window) - ${sex}`);

  // simple 360 × 360 chart inside the 420 × 420 svg
  const M = {top:20,right:20,bottom:40,left:50},
        W = 360, H = 360;
  const g = svg.append('g').attr('transform',`translate(${M.left},${M.top})`);
  const x = d3.scaleLinear().domain(d3.extent(slice,d=>d.activity)).nice().range([0,W]);
  const y = d3.scaleLinear().domain(d3.extent(slice,d=>d.temp)).nice().range([H,0]);

  g.append('g').call(d3.axisLeft(y));
  g.append('g').attr('transform',`translate(0,${H})`).call(d3.axisBottom(x));
  g.append('text').attr('x',W/2).attr('y',H+32).attr('text-anchor','middle')
     .text('Activity (counts)');
  g.append('text').attr('transform','rotate(-90)').attr('x',-H/2).attr('y',-38)
     .attr('text-anchor','middle').text('Temperature (°C)');

  g.selectAll('circle').data(slice).enter().append('circle')
     .attr('cx',d=>x(d.activity)).attr('cy',d=>y(d.temp)).attr('r',3)
     .attr('fill',d=> d.phase==='light' ? COLORS.light : COLORS.dark)
     .attr('stroke','#555').attr('stroke-width',.4);

  // ----- legend ------------------------------------------------------
const lgX = 300, lgY = 20;           // top-right corner of 420×420 SVG
svg.append('rect')                   // yellow square
   .attr('x', lgX).attr('y', lgY)
   .attr('width', 10).attr('height', 10)
   .attr('fill', COLORS.light).attr('stroke','#555');

svg.append('text')
   .attr('x', lgX + 14).attr('y', lgY + 9)
   .text('Light phase').style('font-size','11px');

svg.append('rect')                   // grey square
   .attr('x', lgX).attr('y', lgY + 16)
   .attr('width', 10).attr('height', 10)
   .attr('fill', COLORS.dark).attr('stroke','#555');

svg.append('text')
   .attr('x', lgX + 14).attr('y', lgY + 25)
   .text('Dark phase').style('font-size','11px');

  dlg.showModal();
}

const lineF = d3.line()
    .curve(d3.curveMonotoneX)     // ★ 平滑
    .x(d => x(d.minute))
    .y(d => yF(d.female));

const lineM = d3.line()
    .curve(d3.curveMonotoneX)     // ★ 平滑
    .x(d => x(d.minute))
    .y(d => yM(d.male));


/* close button */
document.getElementById('scatter-close')
        .addEventListener('click',()=>document.getElementById('scatterDlg').close());