function GetModelViewMatrix(translationX, translationY, translationZ, rotationX, rotationY) {
    // Translation matrix
    var T = [
        1,0,0,0,
        0,1,0,0,
        0,0,1,0,
        translationX, translationY, translationZ, 1
    ];
    // Rotation around X axis Rx
    var cX = Math.cos(rotationX), sX = Math.sin(rotationX);
    var Rx = [
        1, 0,   0, 0,
        0, cX, sX, 0,
        0,-sX, cX, 0,
        0, 0,   0, 1
    ];
    //Rotation around Y axis Ry
    var cY = Math.cos(rotationY), sY = Math.sin(rotationY);
    var Ry = [
        cY, 0,-sY, 0,
         0, 1,  0, 0,
        sY, 0, cY, 0,
         0, 0,  0, 1
    ];
    // T * Rx * Ry
    var R = MatrixMult(Ry, Rx);
    var TR = MatrixMult(T, R);
    return TR;
}











class MeshDrawer {
    constructor() {
        // compile shader
        this.prog = InitShaderProgram(meshVS, meshFS);
        //attributes
        this.aPos      = gl.getAttribLocation(this.prog, 'pos');
        this.aTex      = gl.getAttribLocation(this.prog, 'texCoord');
        this.aNrm      = gl.getAttribLocation(this.prog, 'normal');
        // uniforms 
        this.uMVP      = gl.getUniformLocation(this.prog, 'mvp');
        this.uMV       = gl.getUniformLocation(this.prog, 'mv');
        this.uNrmTrans = gl.getUniformLocation(this.prog, 'nrmTrans');
        this.uLightDir = gl.getUniformLocation(this.prog, 'lightDir');
        this.uShininess= gl.getUniformLocation(this.prog, 'shininess');
        this.uShowTex  = gl.getUniformLocation(this.prog, 'showTexture');
        this.uSampler  = gl.getUniformLocation(this.prog, 'tex');

        // buffers
        this.posBuffer = gl.createBuffer();
        this.texBuffer = gl.createBuffer();
        this.nrmBuffer = gl.createBuffer();
        this.triCount = 0;

        // texture state
        this.texture = gl.createTexture();
        this.showTex = true;
        this.hasTex = false;

        // defaults
        this.lightDir = [0,0,1];
        this.shininess = 16.0;
    }

    setMesh(vertPos, texCoords, normals) {
        this.triCount = vertPos.length / 3;
        // positions
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertPos), gl.STATIC_DRAW);
        // tex coords
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
        // normals
        gl.bindBuffer(gl.ARRAY_BUFFER, this.nrmBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    }



    swapYZ(swap) { this.swap = swap; }
    showTexture(show) { this.showTex = show; }
    setLightDir(x,y,z)   { this.lightDir = [x,y,z]; }
    setShininess(s)      { this.shininess = s; }

    draw(mvp, mv, nrmTrans) {
        gl.useProgram(this.prog);

        gl.uniformMatrix4fv(this.uMVP,      false, mvp);
        gl.uniformMatrix4fv(this.uMV,       false, mv );
        gl.uniformMatrix3fv(this.uNrmTrans, false, nrmTrans);
        gl.uniform3fv(this.uLightDir,        this.lightDir);
        gl.uniform1f(this.uShininess,       this.shininess);
        gl.uniform1i(this.uShowTex,         this.showTex?1:0);

        // bind texture if any
        if (this.hasTex && this.showTex) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.uniform1i(this.uSampler, 0);
        }


        //  positions
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.vertexAttribPointer(this.aPos, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.aPos);
        // normals
        gl.bindBuffer(gl.ARRAY_BUFFER, this.nrmBuffer);
        gl.vertexAttribPointer(this.aNrm, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.aNrm);
        // tex coords
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
        gl.vertexAttribPointer(this.aTex, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.aTex);

        gl.drawArrays(gl.TRIANGLES, 0, this.triCount);
    }

    setTexture(img) {
        this.hasTex = true;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
}


// Vertex Shader 
var meshVS = `
    attribute vec3 pos;
    attribute vec2 texCoord;
    attribute vec3 normal;

    uniform mat4 mvp;
    uniform mat4 mv;
    uniform mat3 nrmTrans;
    uniform bool swapYZ;

    varying vec2 vTexCoord;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
        vec3 p = pos;
        if(swapYZ) p = vec3(pos.x, pos.z, -pos.y);
        gl_Position = mvp * vec4(p,1.0);
        vPosition = (mv * vec4(p,1.0)).xyz;
        vNormal   = normalize(nrmTrans * normal);
        vTexCoord = texCoord;
    }
`;


// Fragment Shader
var meshFS = `
    precision mediump float;

    uniform sampler2D tex;
    uniform bool showTexture;
    uniform vec3 lightDir;
    uniform float shininess;

    varying vec2 vTexCoord;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
        vec3 N = normalize(vNormal);
        vec3 L = normalize(lightDir);
        vec3 V = normalize(-vPosition);
        vec3 H = normalize(L + V);

        float diff = max(dot(N,L), 0.0);
        float spec = pow(max(dot(N,H), 0.0), shininess);

        vec3 Kd = vec3(1.0);
        vec3 Ks = vec3(1.0);
        vec3 texColor = showTexture ? texture2D(tex, vTexCoord).rgb : Kd;

        vec3 color = texColor * diff + Ks * spec;
        gl_FragColor = vec4(color,1.0);
    }
`;














