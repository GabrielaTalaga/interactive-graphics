function GetTransform(positionX, positionY, rotation, scale) {
    const rad = rotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    return [
        scale * cos, scale * sin, 0,
        -scale * sin, scale * cos, 0,
        positionX, positionY, 1
    ];
}

function ApplyTransform(trans1, trans2) {
    let result = new Array(9);
    for (let c = 0; c < 3; c++) {
        for (let r = 0; r < 3; r++) {
            let sum = 0;
            for (let k = 0; k < 3; k++) {
                sum += trans2[k * 3 + r] * trans1[c * 3 + k];
            }
            result[c * 3 + r] = sum;
        }
    }
    return result;
}
