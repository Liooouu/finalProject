// Shared helpers for the TrackED draw.io diagram generator.
// Every id is unique across all pages so the merged multi-page file stays valid.

let uid = 0;
export const nextId = () => `c${++uid}`;

export const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\r?\n/g, "&lt;br&gt;");

export class Page {
  constructor(name, width, height) {
    this.name = name;
    this.width = width;
    this.height = height;
    this.cells = [];
  }

  add(value, style, x, y, w, h) {
    const id = nextId();
    this.cells.push(
      `<mxCell id="${id}" value="${esc(value)}" style="${style}" vertex="1" parent="1">` +
        `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`
    );
    return id;
  }

  edge(style, source, target, label = "", o = {}) {
    const id = nextId();
    let s = style;
    if (o.exitX !== undefined) s += `exitX=${o.exitX};exitY=${o.exitY};exitDx=0;exitDy=0;`;
    if (o.entryX !== undefined) s += `entryX=${o.entryX};entryY=${o.entryY};entryDx=0;entryDy=0;`;
    const pts =
      o.points && o.points.length
        ? `<Array as="points">${o.points
            .map(([px, py]) => `<mxPoint x="${px}" y="${py}"/>`)
            .join("")}</Array>`
        : "";
    this.cells.push(
      `<mxCell id="${id}" value="${esc(label)}" style="${s}" edge="1" parent="1" ` +
        `source="${source}" target="${target}"><mxGeometry relative="1" as="geometry">${pts}</mxGeometry></mxCell>`
    );
    return id;
  }

  diagramXml() {
    return (
      `  <diagram id="dg-${nextId()}" name="${esc(this.name)}">\n` +
      `    <mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" ` +
      `arrows="1" fold="1" page="1" pageScale="1" pageWidth="${this.width}" pageHeight="${this.height}" ` +
      `background="#ffffff" math="0" shadow="0">\n` +
      `      <root>\n` +
      `        <mxCell id="0"/>\n` +
      `        <mxCell id="1" parent="0"/>\n` +
      this.cells.map((c) => `        ${c}\n`).join("") +
      `      </root>\n` +
      `    </mxGraphModel>\n` +
      `  </diagram>`
    );
  }
}

export const S = {
  actor: "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;",
  uc: "ellipse;whiteSpace=wrap;html=1;",
  proc: "ellipse;whiteSpace=wrap;html=1;",
  store:
    "shape=partialRectangle;left=0;right=0;whiteSpace=wrap;html=1;align=left;verticalAlign=middle;spacingLeft=10;",
  entity: "rounded=0;whiteSpace=wrap;html=1;",
  act: "rounded=1;arcSize=40;whiteSpace=wrap;html=1;",
  dec: "rhombus;whiteSpace=wrap;html=1;",
  start: "ellipse;fillColor=#111827;strokeColor=#111827;",
  endOuter: "ellipse;fillColor=none;strokeColor=#111827;strokeWidth=2;",
  endInner: "ellipse;fillColor=#111827;strokeColor=#111827;",
  lifeline:
    "shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;container=1;collapsible=0;recursiveResize=0;outlineConnect=0;",
  note: "shape=note;whiteSpace=wrap;html=1;size=14;align=left;verticalAlign=top;spacing=6;",
  frame:
    "rounded=0;whiteSpace=wrap;html=1;fillColor=none;dashed=1;strokeColor=#6b7280;verticalAlign=top;align=left;spacing=6;",
  label: "text;html=1;align=left;verticalAlign=middle;fontStyle=1;fontSize=12;",
  legend: "text;html=1;align=left;verticalAlign=top;fontSize=11;",
  laneHead:
    "rounded=0;whiteSpace=wrap;html=1;fillColor=#1f2937;fontColor=#ffffff;fontStyle=1;strokeColor=#1f2937;",
  laneBody: "rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#9ca3af;",
};

export const E = {
  assoc: "endArrow=none;html=1;rounded=0;",
  include: "endArrow=open;dashed=1;html=1;rounded=0;fontSize=10;",
  flow: "endArrow=block;endFill=1;html=1;rounded=0;",
  er: "edgeStyle=entityRelationEdgeStyle;startArrow=ERmandOne;endArrow=ERmany;startFill=0;endFill=0;html=1;",
  msg: "html=1;verticalAlign=bottom;endArrow=block;endFill=1;rounded=0;fontSize=10;",
  ret: "html=1;verticalAlign=bottom;endArrow=open;dashed=1;rounded=0;fontSize=10;",
};

export function startNode(page, x, y) {
  return page.add("", S.start, x, y, 24, 24);
}

export function endNode(page, x, y) {
  const outer = page.add("", S.endOuter, x, y, 34, 34);
  page.add("", S.endInner, x + 8, y + 8, 18, 18);
  return outer;
}
