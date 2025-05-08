function GetModelViewProjection(projectionMatrix, translationX, translationY, translationZ, rotationX, rotationY) {
	// Translation  matrix
	var T = [
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		translationX, translationY, translationZ, 1
	];

	// Rotation around X axis 
	var cosX = Math.cos(rotationX), sinX = Math.sin(rotationX);
	var Rx = [
		1, 0,     0,    0,
		0, cosX,  sinX, 0,
		0, -sinX, cosX, 0,
		0, 0,     0,    1
	];

	//Rotation around Y axis
	var cosY = Math.cos(rotationY), sinY = Math.sin(rotationY);
	var Ry = [
		cosY, 0, -sinY, 0,
		0,    1, 0,     0,
		sinY, 0, cosY,  0,
		0,    0, 0,     1
	];

	var R = MatrixMult(Ry, Rx);
	var TR = MatrixMult(T, R);
	var MVP = MatrixMult(projectionMatrix, TR);
	return MVP;
}

class MeshDrawer { 
	constructor() {
		this.prog = InitShaderProgram(meshVS, meshFS);
		this.aPos = gl.getAttribLocation(this.prog, 'pos');
		this.aTex = gl.getAttribLocation(this.prog, 'texCoord');
		this.uMVP = gl.getUniformLocation(this.prog, 'mvp');
		this.uSwap = gl.getUniformLocation(this.prog, 'swapYZ');
		this.uShowTex = gl.getUniformLocation(this.prog, 'showTexture');
		this.uSampler = gl.getUniformLocation(this.prog, 'tex');
		this.posBuffer = gl.createBuffer();
		this.texBuffer = gl.createBuffer();
		this.texture = gl.createTexture();
	}

	setMesh(vertPos, texCoords) {
		this.numTriangles = vertPos.length / 3;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertPos), gl.STATIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
	}

	swapYZ(swap) {
		this.swap = swap;
	}

	draw(trans) {
		gl.useProgram(this.prog);
		gl.uniformMatrix4fv(this.uMVP, false, trans);
		gl.uniform1i(this.uSwap, this.swap);
		gl.uniform1i(this.uShowTex, this.showTex);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.uniform1i(this.uSampler, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
		gl.vertexAttribPointer(this.aPos, 3, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(this.aPos);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
		gl.vertexAttribPointer(this.aTex, 2, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(this.aTex);

		gl.drawArrays(gl.TRIANGLES, 0, this.numTriangles);
	}


	setTexture(img) {
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	}

	showTexture(show) {
		this.showTex = show;
	}
}





// Vertex Shader
var meshVS = `
	attribute vec3 pos;
	attribute vec2 texCoord;
	uniform mat4 mvp;
	uniform bool swapYZ;
	varying vec2 vTexCoord;
	void main() {
		vec3 position = pos;
		if (swapYZ) {
			position = vec3(pos.x, pos.z, -pos.y);
		}
		gl_Position = mvp * vec4(position, 1.0);
		vTexCoord = texCoord;
	}
`;


// Fragment Shader
var meshFS = `
	precision mediump float;
	uniform sampler2D tex;
	uniform bool showTexture;
	varying vec2 vTexCoord;
	void main() {
		if (showTexture)
			gl_FragColor = texture2D(tex, vTexCoord);
		else
			gl_FragColor = vec4(1, 1, 1, 1);
	}
`;


