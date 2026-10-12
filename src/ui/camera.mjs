// Somente transformações visuais. Jamais altera posições ou regras da batalha.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function createCamera(canvas, board, getViewport, getReservedSpace, isPanning) {
  const camera = { x:0, y:0, scale:1, targetX:0, targetY:0, targetScale:1 };
  const screenPoint = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    return { x:clientX - rect.left, y:clientY - rect.top };
  };
  const screenToWorld = point => ({ x:(point.x-camera.x)/camera.scale, y:(point.y-camera.y)/camera.scale });
  const clientToWorld = (clientX, clientY) => screenToWorld(screenPoint(clientX, clientY));
  function fitCamera() {
    const screen = getViewport();
    const {top, bottom} = getReservedSpace();
    const world = { x:board.x-34, y:board.y-42, w:board.columns*board.tile+68, h:board.rows*board.tile+80 };
    const usableH = Math.max(190,screen.h-top-bottom);
    const scale = clamp(Math.min((screen.w-30)/world.w,usableH/world.h),.28,1.9);
    camera.scale = camera.targetScale = scale;
    camera.x = camera.targetX = (screen.w-world.w*scale)/2-world.x*scale;
    camera.y = camera.targetY = top+(usableH-world.h*scale)/2-world.y*scale;
  }
  function zoomAt(screenPos, factor) {
    const before = screenToWorld(screenPos);
    camera.targetScale = clamp(camera.targetScale*factor,.45,2.7);
    camera.targetX = screenPos.x-before.x*camera.targetScale;
    camera.targetY = screenPos.y-before.y*camera.targetScale;
  }
  function updateCamera(dt) {
    if (isPanning()) return;
    const t = 1-Math.pow(.0015,dt);
    camera.scale += (camera.targetScale-camera.scale)*t;
    camera.x += (camera.targetX-camera.x)*t;
    camera.y += (camera.targetY-camera.y)*t;
    if(Math.abs(camera.targetScale-camera.scale)<.0005) camera.scale=camera.targetScale;
    if(Math.abs(camera.targetX-camera.x)<.05) camera.x=camera.targetX;
    if(Math.abs(camera.targetY-camera.y)<.05) camera.y=camera.targetY;
  }
  return {camera,screenPoint,screenToWorld,clientToWorld,fitCamera,zoomAt,updateCamera};
}
