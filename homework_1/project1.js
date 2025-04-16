function composite(bgImg, fgImg, fgOpac, fgPos) {
    const bgData = bgImg.data;
    const fgData = fgImg.data;
    const bgWidth = bgImg.width;
    const bgHeight = bgImg.height;
    const fgWidth = fgImg.width;
    const fgHeight = fgImg.height;
  
    for (let y = 0; y < fgHeight; y++) {
      for (let x = 0; x < fgWidth; x++) {
        const bgX = x + fgPos.x;
        const bgY = y + fgPos.y;
  
        if (bgX < 0 || bgX >= bgWidth || bgY < 0 || bgY >= bgHeight) continue;
  
        const fgIdx = (y * fgWidth + x) * 4;
        const bgIdx = (bgY * bgWidth + bgX) * 4;
  
        const fgAlpha = fgData[fgIdx + 3] / 255 * fgOpac;
        const invAlpha = 1 - fgAlpha;
  
        for (let c = 0; c < 3; c++) { 
          bgData[bgIdx + c] = Math.round(
            fgData[fgIdx + c] * fgAlpha + bgData[bgIdx + c] * invAlpha
          );
        }
  
        
        bgData[bgIdx + 3] = Math.round(
          fgAlpha * 255 + bgData[bgIdx + 3] * invAlpha
        );
      }
    }
  }
  