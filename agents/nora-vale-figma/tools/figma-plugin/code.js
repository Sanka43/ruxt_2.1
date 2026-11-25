figma.showUI(__html__, { visible: false, width: 320, height: 160, title: 'Nora Vale bridge' });
figma.ui.onmessage = async (message) => {
  const p = message && message.command;
  if (!p || !p.type) return;
  try {
    if (p.type === 'composition') {
      const frame = figma.createFrame();
      frame.name = p.name;
      frame.resize(800,600);
      frame.x = Math.max(0, ...figma.currentPage.children.filter(n => n !== frame).map(n => n.x + n.width + 40));
      for (const spec of p.shapes) {
        if (spec.type === 'createRect') {
          const node = figma.createRectangle();
          frame.appendChild(node);
          node.name = spec.name || 'Card';
          node.resize(spec.width, spec.height);
          node.x = spec.x;
          node.y = spec.y;
          node.fills = [{ type: 'SOLID', color: spec.color }];
          node.cornerRadius = Number(spec.radius || 0);
          continue;
        }
        if (spec.type === 'createText') {
          const node = figma.createText();
          frame.appendChild(node);
          await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
          node.name = spec.name || 'Text';
          node.characters = String(spec.text || '');
          node.fontSize = Number(spec.fontSize || 16);
          node.x = spec.x;
          node.y = spec.y;
          node.fills = [{ type: 'SOLID', color: spec.color || { r: .08, g: .1, b: .16 } }];
          continue;
        }
        if (spec.type === 'cube') {
          if (!/^#[0-9a-f]{6}$/i.test(spec.color)) throw Error('Invalid cube color');
          const cube = figma.createNodeFromSvg('<svg xmlns="http://www.w3.org/2000/svg" width="144" height="164" viewBox="0 0 144 164"><g fill="'+spec.color+'"><path d="M72 0 144 41 72 82 0 41Z"/><path d="M0 41 72 82 72 164 0 123Z"/><path d="M144 41 72 82 72 164 144 123Z"/></g><path fill="white" opacity=".22" d="M72 0 144 41 72 82 0 41Z"/><path opacity=".24" d="M144 41 72 82 72 164 144 123Z"/></svg>');
          frame.appendChild(cube);
          cube.name = spec.name;
          cube.x = spec.x;
          cube.y = spec.y;
          continue;
        }
        const ball = figma.createEllipse();
        frame.appendChild(ball);
        ball.resize(spec.width,spec.height);
        ball.x = spec.x;
        ball.y = spec.y;
        ball.name = spec.name;
        ball.fills = [{type:'SOLID',color:spec.color}];
      }
      figma.currentPage.selection = [frame];
      figma.viewport.scrollAndZoomIntoView([frame]);
      figma.ui.postMessage({type:'done',id:p.id,frameId:frame.id,nodeIds:frame.children.filter(n=>n.visible).map(n=>n.id),ellipses:frame.children.filter(n=>n.type==='ELLIPSE' && n.visible).map(n=>n.id)});
      return;
    }
    if (p.type === 'createFrame') {
      const node = figma.createFrame(); node.name = p.name || 'Nora frame'; node.resize(Number(p.width)||390, Number(p.height)||844); node.x = Number(p.x)||0; node.y = Number(p.y)||0; node.fills = [{type:'SOLID',color:{r:.98,g:.97,b:.93}}]; figma.currentPage.appendChild(node); figma.currentPage.selection=[node]; figma.viewport.scrollAndZoomIntoView([node]);
    } else if (p.type === 'createText') {
      const node = figma.createText(); await figma.loadFontAsync({family:'Inter',style:'Regular'}); node.characters=String(p.text||''); node.fontSize=Number(p.fontSize)||24; node.x=Number(p.x)||0; node.y=Number(p.y)||0; node.fills=[{type:'SOLID',color:{r:.12,g:.1,b:.08}}]; figma.currentPage.appendChild(node);
    } else if (p.type === 'createRect') {
      const node=figma.createRectangle(); node.name=p.name||'Card'; node.resize(Number(p.width)||240,Number(p.height)||120); node.x=Number(p.x)||0; node.y=Number(p.y)||0; const c=p.color||{r:.92,g:.62,b:.12}; node.fills=[{type:'SOLID',color:c}]; figma.currentPage.appendChild(node);
    } else if (p.type === 'createEllipse') {
      const node=figma.createEllipse(); node.name=p.name||'Ellipse'; node.resize(Number(p.width)||120,Number(p.height)||120); node.x=Number(p.x)||0; node.y=Number(p.y)||0; const c=p.color||{r:.9,g:.08,b:.08}; node.fills=[{type:'SOLID',color:c}]; figma.currentPage.appendChild(node); figma.currentPage.selection=[node]; figma.viewport.scrollAndZoomIntoView([node]);
    } else if (p.type === 'clearPage') { figma.currentPage.children.slice().forEach(n=>n.remove()); }
    else throw Error('Unsupported canvas operation');
    figma.notify(`Nora applied ${p.type}`);
    fetch('http://localhost:17451/complete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: p.id, type: p.type }) }).catch(() => {});
    figma.ui.postMessage({type:'done',id:p.id});
  } catch (error) { figma.ui.postMessage({type:'error',id:p.id,error:String(error.message||error)}); }
};
