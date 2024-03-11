
//import "./lib/gl-matrix-3.4.0min"; //Apparently this isn't needed
//import "ObjectToDraw.js"
const { mat2, mat2d, mat4, mat3, quat, quat2, vec2, vec3, vec4 } = glMatrix; //LITERALLY THE ONLY LINE ADDED DUE TO NEWER VERSION OF gl-matrix-min.js

const BROWSER_WIDTH_OFFSET = 15;
const BROWSER_HEIGHT_OFFSET = 15;

const MAX_NUM_LIGHTS = 8;

var gl;

var objectsToDraw = [];
var lightList = [];

function initGL(canvas) {
    try {
        gl = canvas.getContext("experimental-webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    } catch (e) { }
    if (!gl) {
        alert("Could not initialise WebGL");
    }
}

function getShader(gl, id) {
    //Load the shader code by it's ID, as assigned in
    //the script element (e.g. "shader-fs" or "shader-vs")
    var shaderScript = document.getElementById(id);
    if (!shaderScript) {
        //console.log("Shader document didn't get?");
        return null;
    }
    var k = shaderScript.firstChild;
    var str = "";
    //While firstChild exists
    while (k) {
        ///If the firstChild is a TEXT type document
        if (k.nodeType == 3) {
            //Append the text to str.
            str += k.textContent;
        }
        k = k.nextSibling;
    }
    var shader;
    if (shaderScript.type == "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        //console.log("Shader type not right?")
        return null;
    }
    //Now we have the type and the code, and we 
    //provide it to WebGL as such, then compile the shader
    gl.shaderSource(shader, str);
    gl.compileShader(shader);
    //If the compilation of the shader code fails, report 
    //and return nothing, since the shader failed to compile.
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }
    //If there were no errors, return the compiled shader.
    return shader;
}

var shaderBasic;
var shaderFrag;
function createShader(vert, frag) {
    let fragmentShader = getShader(gl, frag);
    let vertexShader = getShader(gl, vert);
    //Create the program, then attach and link 
    let shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    //Check for linker errors.
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders: " + gl.getProgramInfoLog(shaderProgram));
    }


    //Attach shaderprogram to openGL context.
    gl.useProgram(shaderProgram);
    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    //associate vertexColorAttribute with //internal shader variable aVertexColor
    shaderProgram.vertexColorAttribute = gl.getAttribLocation(shaderProgram, "aVertexColor");
    //identifies this as a second vertex attribute array for use when drawing
    gl.enableVertexAttribArray(shaderProgram.vertexColorAttribute);

    //do it for texture UV
    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

    shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);


    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");

    shaderProgram.useLightingUniform = gl.getUniformLocation(shaderProgram, "uUseLighting");
    shaderProgram.ambientColorUniform = gl.getUniformLocation(shaderProgram, "uAmbientColor");

    //multiple light support?
    shaderProgram.lights = []

    for (let i = 0; i < MAX_NUM_LIGHTS; ++i) {
        light = {}
        light.enabledUniform = gl.getUniformLocation(shaderProgram, "uLight[" + i + "].enabled");
        light.positionUniform = gl.getUniformLocation(shaderProgram, "uLight[" + i + "].position");
        light.colorUniform = gl.getUniformLocation(shaderProgram, "uLight[" + i + "].color");
        light.isDirectionalUniform = gl.getUniformLocation(shaderProgram, "uLight[" + i + "].isDirectional");
        light.fadeUniform = gl.getUniformLocation(shaderProgram, "uLight[" + i + "].fade");
        shaderProgram.lights.push(light);
    }

    shaderProgram.useTextureUniform = gl.getUniformLocation(shaderProgram, "uUseTexture");
    shaderProgram.specularityUniform = gl.getUniformLocation(shaderProgram, "uSpecularity");
    shaderProgram.diffusionUniform = gl.getUniformLocation(shaderProgram, "uDiffusion");

    return shaderProgram;
}

var mvMatrix = mat4.create();
var pMatrix = mat4.create();
var normalMatrix = mat3.create();

//Here we connect the uniform matrices 
function setMatrixUniforms(shader = shaderBasic, mvMatrix) {
    gl.uniformMatrix4fv(shader.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(shader.mvMatrixUniform, false, mvMatrix);

    mat3.fromMat4(normalMatrix, mvMatrix);
    mat3.invert(normalMatrix, normalMatrix);
    mat3.transpose(normalMatrix, normalMatrix);
    gl.uniformMatrix3fv(shader.nMatrixUniform, false, normalMatrix);

}

function setLightingUniforms(shader = shaderBasic, useLighting = 1) {
    gl.uniform1f(shader.useLightingUniform, useLighting);
    gl.uniform3f(shader.ambientColorUniform, 0.3, 0.3, 0.33);

    //default enability
    for (let i = 0; i < MAX_NUM_LIGHTS; ++i) {
        gl.uniform1f(shader.lights[i].enabledUniform, 0);
    }
    let n = Math.min(lightList.length, MAX_NUM_LIGHTS);
    for (let i = 0; i < n; ++i) {
        let light = lightList[i];
        let lightPos = light.worldPos();
        gl.uniform3f(shader.lights[i].positionUniform, lightPos[0], lightPos[1], lightPos[2]);
        gl.uniform3f(shader.lights[i].colorUniform, light.color[0], light.color[1], light.color[2]);
        gl.uniform1f(shader.lights[i].isDirectionalUniform, light.isDirectional);
        gl.uniform1f(shader.lights[i].fadeUniform, light.fade);
        gl.uniform1f(shader.lights[i].enabledUniform, light.enabled);
    }
    /*
    gl.uniform3f(shader.lights[3].positionUniform, 0, 0, -45);
    gl.uniform3f(shader.lights[3].colorUniform, 0.7, 0.7, 0.8);
    gl.uniform1f(shader.lights[3].isDirectionalUniform, 0);
    gl.uniform1f(shader.lights[3].fadeUniform, 0);
    gl.uniform1f(shader.lights[3].enabledUniform, 1);
    */
}
function setMaterialUniforms(shader = shaderBasic, useTexture = 1, diffusion = 0.5, specularity = 1) {
    gl.uniform1f(shader.useTextureUniform, useTexture);
    gl.uniform1f(shader.diffusionUniform, diffusion);
    gl.uniform1f(shader.specularityUniform, specularity);
}

var textureList = [];
function initTexture() {
    for (src of textureSrcs) {
        let texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
            new Uint8Array([255, 0, 255, 255]));//magenta incase of texture load failure
        texture.image = new Image();
        texture.image.onload = function () {
            handleLoadedTexture(texture)
        }
        //worldTexture.image.crossOrigin = "anonymous";
        texture.image.src = src;
        textureList.push(texture);
    }
    //console.log(textureList);
}

///reads the texture image and saves it to the variable provided.
function handleLoadedTexture(texture) {
    //must resize it to 2^n * 2^n here
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    //console.log(texture);
}


//helper functions
function deg2rad(deg) {
    return deg * Math.PI / 180;
}
function rad2deg(rad) {
    return rad / Math.PI * 180;
}

function renderParentObject(obj) {
    if (!obj.enabled) {
        return;
    }
    //initialize mvMatrix
    mat4.identity(mvMatrix);
    renderSubObject(obj, mvMatrix);
}
//not tested, not used, pure fucking garbage rn
//only difference being taking a copy of old mvMatrix instead of making a new one
function renderSubObject(obj, mvMatrixParent) {
    let mvMatrix = mat4.create();
    //mat4.copy(mvMatrix, mvMatrixParent);
    let mvMatrixChild = mat4.create();
    mvMatrixChild = mat4.fromRotationTranslationScale(mvMatrixChild, obj.rot, obj.pos, obj.scale);
    //mat4.translate(mvMatrix, mvMatrix, obj.pos);
    //mat4.rotate(mvMatrix, mvMatrix, obj.rot[0], [0, 1, 0]);   //vertical axis
    //mat4.scale(mvMatrix, mvMatrix, obj.scale);
    mvMatrix = mat4.multiply(mvMatrix, mvMatrixParent, mvMatrixChild);

    //if there is something within this object to be drawn, draw it. Otherwise go straight into sub-objects.
    if (obj.vertexPosBuffer.numItems >= 0) {

        let shader;
        if (obj.shader) {
            shader = obj.shader;
        } else {
            shader = shaderBasic;
        }
        gl.useProgram(shader);
        //load in vertices
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertexPosBuffer);
        gl.vertexAttribPointer(shader.vertexPositionAttribute, obj.vertexPosBuffer.itemSize, gl.FLOAT, false, 0, 0);
        //load in color
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertexColBuffer);
        gl.vertexAttribPointer(shader.vertexColorAttribute, obj.vertexColBuffer.itemSize, gl.FLOAT, false, 0, 0);

        //load in texture

        
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertexTextureCoordBuffer);
        gl.vertexAttribPointer(shader.textureCoordAttribute, obj.vertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, obj.texture);
        //console.log(obj.texture);
        gl.uniform1i(shader.samplerUniform, 0);


        //load in normals
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertexNormalCoordBuffer);
        gl.vertexAttribPointer(shader.vertexNormalAttribute, obj.vertexNormalCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

        setMatrixUniforms(shader, mvMatrix);
        setLightingUniforms(shader, obj.useLighting);
        setMaterialUniforms(shader, obj.useTexture, obj.diffusion, obj.specularity);

        gl.drawArrays(obj.drawMode, 0, obj.vertexPosBuffer.numItems);
    }

    //go into sub-objects
    for (sub of obj.subObjects) {
        if (sub.enabled) {
            renderSubObject(sub, mvMatrix);
        }
    }

}

///////////////////////////////// SCENE MANAGEMENT SECTION /////////////////////////////////

const textureSrcs = [];

var objectLookup = []

function initScene() {
    objectsToDraw = [];

    //create the parent thing
    let centerObject = new ObjectToDraw();
    centerObject.pos = [0, 0, -10];
    centerObject.rotate([deg2rad(24), 0, 0]);
    objectsToDraw.push(centerObject);


    let lightDir = new ObjectLight();
    lightDir.init(true, [1, 1, 1], [0.5, 0.5, 0.5]);
    //lightDir.enabled = false;

    //fancy 3 point lights

    let lightPoint = new ObjectLight();
    lightPoint.init(false, [-5, 3, -5], [0.8, 0, 0], 0.25);
    //lightPoint.enabled = false;

    let lightPoint2 = new ObjectLight();
    lightPoint2.init(false, [0, 3, 3], [0.8, 0.8, 0], 0.25);
    //lightPoint2.enabled = false;

    let lightPoint3 = new ObjectLight();
    lightPoint3.init(false, [5, 3, -5], [0, 0, 0.8], 0.25);
    //lightPoint2.enabled = false;

    centerObject.push(lightDir);
    centerObject.push(lightPoint);
    centerObject.push(lightPoint2);
    centerObject.push(lightPoint3);
    lightList.push(lightDir);
    lightList.push(lightPoint);
    lightList.push(lightPoint2);
    lightList.push(lightPoint3);

    const BORDER_RADIUS = 7;

    //falling stuff
    let prototypeMac = new MacToDraw();
    let color = [0.5, 0.5, 0.2];
    prototypeMac.init(18, 18, 0.5, color, 0.7, 0.25);
    for(let i=0;i<200;++i){
        let mac = new MacToDraw();
        let color = [0.3, 0.3, 0.3];
        color[0] += Math.random() * 0.7;
        color[1] += Math.random() * 0.7;
        color[2] += Math.random() * 0.7;
        //mac.init(18, 18, 0.5, color, 0.7, 0.25);
        mac.copyFromWithNewColor(prototypeMac, color);
        mac.pos = [Math.random() * 2 * BORDER_RADIUS - BORDER_RADIUS, Math.random() * 2 * BORDER_RADIUS - BORDER_RADIUS, Math.random() * 2 * BORDER_RADIUS - BORDER_RADIUS];
        mac.rotate([Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI]);
        mac.speed[1] = -0.5 + Math.random() * 0.2;
        mac.rotSpeed = [Math.random() * 1 - 0.5, Math.random()  * 1 - 0.5, Math.random() * 1 - 0.5];
        mac.postTick = function() {
            if(mac.pos[1] <= -BORDER_RADIUS){
                mac.pos[1] += 2 * BORDER_RADIUS;
                mac.pos = [Math.random() * 2 * BORDER_RADIUS - BORDER_RADIUS, mac.pos[1], Math.random() * 2 * BORDER_RADIUS - BORDER_RADIUS];
            }
        }
        centerObject.push(mac);
        objectLookup.push(mac);
    }



    //square for sanity
    /*
    let cube = cubeWireframe(BORDER_RADIUS);
    centerObject.push(cube);
    */


}


function cubeWireframe(radius = 10, dashLength = 0.25, dashColor = [0.5, 0.5, 0.5, 1]) {
    let parent = new ObjectToDraw();
    const from = [
        [1, 1, 1], [1, 1, 1], [1, 1, 1],
        [-1, 1, -1], [-1, 1, -1], [-1, 1, -1],
        [-1, -1, 1], [-1, -1, 1], [-1, -1, 1],
        [1, -1, -1], [1, -1, -1], [1, -1, -1]
    ];
    const to = [
        [-1, 1, 1], [1, -1, 1], [1, 1, -1],
        [1, 1, -1], [-1, -1, -1], [-1, 1, 1],
        [1, -1, 1], [-1, 1, 1], [-1, -1, -1],
        [-1, -1, -1], [1, 1, -1], [1, -1, 1]
    ];
    for (let i = 0; i < 12; ++i) {
        let line = new LineToDraw();
        let s = [from[i][0] * radius, from[i][1] * radius, from[i][2] * radius];
        let t = [to[i][0] * radius, to[i][1] * radius, to[i][2] * radius];
        line.init(s, t, dashLength, dashColor);
        parent.push(line);
    }
    return parent;
}


///////////////////////////////// DRAW SCENE AND TICK /////////////////////////////////

function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    //allocate a perspective matrix in pMatrix
    mat4.perspective(pMatrix, 45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0);

    //simply draw all objects?

    for (obj of objectsToDraw) {
        renderParentObject(obj);
    }

}


let timePrev = new Date().getTime();
let timeNow = 0;
function tick() {
    timeNow = new Date().getTime();

    requestAnimFrame(tick);
    resize(gl.canvas);

    //update shaders
    for(obj of objectLookup){
        obj.shader = shaderFrag;
    }


    //update if using textures
    for(obj of objectLookup){
        obj.useTexture = false;
    }



    let deltaTime = timeNow - timePrev; //deltaTime: time elapsed till last tick, in millisecond(s)
    if (deltaTime >= 200) {  //deltaTime cutoff in case of switching windows
        deltaTime = 0;
    }
    //animateSphere(deltaTime);

    for (obj of objectsToDraw) {
        //console.log(objectsToDraw);
        obj.tick(deltaTime);
    }

    updateOverlays();
    drawScene();
    timePrev = timeNow;

}

/////////////////////////////////  MOUSE INPUTS /////////////////////////////////
var mouseDown = false;
var lastMouseX = null;
var lastMouseY = null;

function handleMouseDown(event) {
    mouseDown = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    //console.log("MOUSE DOWN");
}

function handleMouseUp(event) {
    mouseDown = false;
    //console.log("MOUSE UP");
}

function handleMouseMove(event) {
    if (!mouseDown) { return; }
    var newX = event.clientX;
    var newY = event.clientY;
    var deltaX = newX - lastMouseX;
    //var deltaY = newY - lastMouseY;
    var deltaY = 0; //fuck gimbal locks

    //code for doing rotation. add all rotations to the center object.
    //objectsToDraw[0] is the root object of the main scene.
    objectsToDraw[0].rotate([deg2rad(deltaY / 100), deg2rad(deltaX / 100), 0]);

    lastMouseX = newX
    lastMouseY = newY;
}

///////////////////////////////// WEB PAGE SECTION /////////////////////////////////
function resize(canvas) {
    let dispWidth = window.innerWidth - BROWSER_WIDTH_OFFSET;	  //browser width
    let dispHeight = window.innerHeight - BROWSER_HEIGHT_OFFSET;  //browser height
    //check if the canvas is not the same size
    if (canvas.width != dispWidth || canvas.height != dispHeight) {
        canvas.width = dispWidth;
        canvas.height = dispHeight;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    }
}

function initHtmlElements() {
}
function updateOverlays() {

}




function webGLStart() {
    var canvas = document.getElementById("webGLcanvas");
    //test something
    //LoadPLY("skdfgalisdhfg");
    //console.log(p)


    initHtmlElements();
    canvas.width = window.innerWidth - BROWSER_WIDTH_OFFSET;
    canvas.height = window.innerHeight - BROWSER_HEIGHT_OFFSET;
    //Create the GL viewport
    initGL(canvas);
    ///Load the shaders and buffers into the GPU    
    shaderBasic = createShader("vert_flat", "frag_flat");
    shaderFrag = createShader("vert_phong", "frag_phong");
    initTexture();
    initScene();


    //handle mouse inputs with our callbacks
    canvas.onmousedown = handleMouseDown;
    document.onmouseup = handleMouseUp;
    document.onmousemove = handleMouseMove;

    //Set the background color to opaque black
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    //Render only pixels in front of the others.
    gl.enable(gl.DEPTH_TEST);
    //render the scene
    tick(canvas);




}


