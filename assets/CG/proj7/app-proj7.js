
//import "./lib/gl-matrix-3.4.0min"; //Apparently this isn't needed
const { mat2, mat2d, mat4, mat3, quat, quat2, vec2, vec3, vec4 } = glMatrix; //LITERALLY THE ONLY LINE ADDED DUE TO NEWER VERSION OF gl-matrix-min.js
const BROWSER_WIDTH_OFFSET = 20;
const BROWSER_HEIGHT_OFFSET = 150;
const MAX_NUM_SPHERES = 16;
const MAX_NUM_BOUNCES = 10;
var gl;
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
    if (!shaderScript) { return null; }
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



var shaderProgram;
function initShaders() {
    var fragmentShader = getShader(gl, "shader-fs");
    var vertexShader = getShader(gl, "shader-vs");
    //Create the program, then attach and link 
    shaderProgram = gl.createProgram();
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
    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");

    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");


    shaderProgram.numSphereUniform = gl.getUniformLocation(shaderProgram, "uNumSpheres");
    shaderProgram.bouncesUniform = gl.getUniformLocation(shaderProgram, "uBounces");
    shaderProgram.lightingModelUniform = gl.getUniformLocation(shaderProgram, "uLightingModel");
    //multiple light support?
    shaderProgram.spheres = []
    for (let i = 0; i < MAX_NUM_SPHERES; ++i) {
        sphere = {}
        sphere.enabledUniform = gl.getUniformLocation(shaderProgram, "uSpheres[" + i + "].enabled");
        sphere.positionUniform = gl.getUniformLocation(shaderProgram, "uSpheres[" + i + "].position");
        sphere.colorUniform = gl.getUniformLocation(shaderProgram, "uSpheres[" + i + "].color");
        sphere.radiusUniform = gl.getUniformLocation(shaderProgram, "uSpheres[" + i + "].radius");
        shaderProgram.spheres.push(sphere);
    }
}



//Here we connect the uniform matrices 
function setMatrixUniforms() {
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

var ratio;
var cornerVertexPosBuffer;

//We will Generate the geometry with this function
function initTwoTriangles() {
    //this holds the positions
    //initPseudoViewportPositions();
    ratio = gl.viewportWidth / gl.viewportHeight;

    cornerVertexPosBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerVertexPosBuffer);
    
    var vertices = [
        -ratio, 1.0, 0.0,
        -ratio, -1.0, 0.0,
        ratio, 1.0, 0.0,
        -ratio, -1.0, 0.0,
        ratio, 1.0, 0.0,
        ratio, -1.0, 0.0
    ];
    /*
   //get a square in
   var vertices = [
    -1, 1.0, 0.0,
    -1, -1.0, 0.0,
    1, 1.0, 0.0,
    -1, -1.0, 0.0,
    1, 1.0, 0.0,
    1, -1.0, 0.0
];*/
    //console.log(vertices);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    cornerVertexPosBuffer.itemSize = 3;
    cornerVertexPosBuffer.numItems = 6;
}

var sphereList = [];
var scenePivot = new Sphere();//no need to init this it's just an empty pivot
var numSpheres = 0;
var bounces = 10;
function newSphere(x, y, z, radius = 1, pivot = scenePivot){
    s = new Sphere();
    s.init(x,y,z,radius);
    numSpheres += 1;
    sphereList.push(s);
    pivot.push(s);
    return s;
}
function initScene(){
    //first move the pivot
    scenePivot.pos = [0, 0, -8];
    scenePivot.rotateX(deg2rad(15));

    //give it a little rotation
    scenePivot.speed = [0,0,0]
    //scenePivot.scale = [0.1,0.1,0.1]
    scenePivot.rotSpeed[1] = 0;
    let centerSphere = newSphere(0,0,0,4,scenePivot);
    centerSphere.color = [1, 0.7, 0.7]
    //scenePivot.push(centerSphere);
    //sphereList.push(centerSphere);
    let centerpiv = new Sphere(); 
    //centerpiv.pos = [2,0,0]
    centerpiv.rotateZ(deg2rad(30));
    centerpiv.rotSpeed[1] = 0.2;
    scenePivot.push(centerpiv); 

    let centerpiv2 = new Sphere(); 
    centerpiv2.rotateZ(deg2rad(-60));
    centerpiv2.rotSpeed[1] = 0.3;
    scenePivot.push(centerpiv2); 

    //procedurally generate 7 balls in a ring
    for(let i=0; i<7; ++i){
        let theta = 2 * Math.PI * i / 7 + deg2rad(-18);
        let tilt = 0;
        //tilt = deg2rad(30);
        let sphereRadius = 1;
        let ringRadius = 6;
        let x = Math.cos(theta) * ringRadius;
        let z = Math.sin(theta) * ringRadius;   
        let y = x * Math.sin(tilt);
        x *= Math.cos(tilt);
        let s = newSphere(x, y, z, sphereRadius, centerpiv);    //Can't get the scene manager working somehow. WTF??
        s.color = [1, 1, 0.7]
        centerpiv.push(s);
        //sphereList.push(s);
        if(i==0){
            s.preTick = function(){
                //console.log(scenePivot.rot);
                //console.log(s.worldPos());
            }

        }
    }    
    //another 8 balls in another ring
    
    for(let i=0; i<8; ++i){
        let theta = 2 * Math.PI * i / 8 + deg2rad(18);
        let tilt = 0;
        //tilt = deg2rad(-60);
        let sphereRadius = 0.5;
        let ringRadius = 4.8;
        let x = Math.cos(theta) * ringRadius;
        let z = Math.sin(theta) * ringRadius;   
        let y = x * Math.sin(tilt);
        x *= Math.cos(tilt);
        let s = newSphere(x, y, z, sphereRadius, centerpiv2);
        s.color = [0.7, 0.7, 1]
        centerpiv2.push(s);
    }
    
    
    //test sphere
}
var lightingModel = 2;

function setSphereUniforms() {
    gl.uniform1i(shaderProgram.numSphereUniform, numSpheres);
    gl.uniform1i(shaderProgram.bouncesUniform, bounces);
    //default enability
    for (let i = 0; i < MAX_NUM_SPHERES; ++i) {
        gl.uniform1f(shaderProgram.spheres[i].enabledUniform, 0);
    }
    let n = Math.min(numSpheres, MAX_NUM_SPHERES);
    for (let i = 0; i < n; ++i) {
        let sphere = sphereList[i];
        let spherePos = sphere.worldPos();
        gl.uniform1f(shaderProgram.spheres[i].enabledUniform, sphere.enabled);
        gl.uniform3f(shaderProgram.spheres[i].positionUniform, spherePos[0], spherePos[1], spherePos[2]);
        gl.uniform3f(shaderProgram.spheres[i].colorUniform, sphere.color[0], sphere.color[1], sphere.color[2]);
        gl.uniform1f(shaderProgram.spheres[i].radiusUniform, sphere.radius);
        //console.log(spherePos);
    }

    gl.uniform1i(shaderProgram.lightingModelUniform, lightingModel);


}



var mvMatrix = mat4.create();
var pMatrix = mat4.create();
function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    //allocate a orthogonal matrix in pMatrix
    mat4.ortho(pMatrix, -ratio, ratio, -1, 1, -1000, 1000); //resize with the screen
    //mat4.ortho(pMatrix, -1, 1, -1, 1, -1000, 1000); //won't resize with the screen
    //allocate an identity matrix in mvMatrix
    mat4.identity(mvMatrix);
    //Add a translation into mvMatrix
    mat4.translate(mvMatrix, mvMatrix, [0, 0, -1.0]);
    //////////////Load in Triangle Vertices
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerVertexPosBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, cornerVertexPosBuffer.itemSize, gl.FLOAT, false, 0, 0);
    setMatrixUniforms();
    setSphereUniforms();
    gl.drawArrays(gl.TRIANGLES, 0, cornerVertexPosBuffer.numItems);
}


function resize(canvas) {
    //let dispWidth = window.innerWidth - BROWSER_WIDTH_OFFSET;	  //browser width
    //let dispHeight = window.innerHeight - BROWSER_HEIGHT_OFFSET;  //browser height
    let dispWidth = canvas.width;	  //browser width
    let dispHeight = canvas.height;  //browser height
    //check if the canvas is not the same size
    if (canvas.width != dispWidth || canvas.height != dispHeight) {
        canvas.width = dispWidth;
        canvas.height = dispHeight;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    }
    initTwoTriangles();
}
var timePrev = new Date().getTime();
var timeNow = 0;
function tick() {
    timeNow = new Date().getTime();
    requestAnimFrame(tick);
    resize(gl.canvas);
    updateHtmlElements();
    //ratio = gl.viewportWidth / gl.viewportHeight; //whether update ratios or not? a question.
    //update enability
    //objectLookup[0].enabled = checkboxDispBunny.checked;
    //objectLookup[1].enabled = checkboxDispBudda.checked;

    let deltaTime = timeNow - timePrev; //deltaTime: time elapsed till last tick, in millisecond(s)
    if (deltaTime >= 200) {  //deltaTime cutoff in case of switching windows
        deltaTime = 0;
    }
    //animateSphere(deltaTime);
    paused = checkboxPause.checked;
    if(paused){
        deltaTime = 0;
    }
    scenePivot.tick(deltaTime);//it also ticks all spheres.

    //updateOverlays();
    drawScene();
    timePrev = timeNow;
}

var paused = false;

var checkboxPause;

var sliderNumSpheres;
var textNumSpheres;
var textNumSpheresContent;

var sliderBounces;
var textBounces;
var textBouncesContent;

var dropdownModelSelection;

function initHtmlElements() {

    dropdownModelSelection = document.getElementById("lightingModel")

    checkboxPause = document.getElementById("pause");

    sliderNumSpheres = document.getElementById("numSphereSlider");
    textNumSpheres = document.getElementById("numSphereText");
    textNumSpheresContent = document.createTextNode("");
    textNumSpheres.appendChild(textNumSpheresContent);

    sliderNumSpheres.value = numSpheres;
    sliderNumSpheres.max = numSpheres;
    sliderNumSpheres.oninput = function(){
        numSpheres = this.value;
        //textNumSpheresContent.nodeValue = this.value;
    }

    sliderBounces = document.getElementById("BouncesSlider");
    textBounces = document.getElementById("BouncesText");
    textBouncesContent = document.createTextNode("");
    textBounces.appendChild(textBouncesContent);

    sliderBounces.value = bounces;
    sliderBounces.max = MAX_NUM_BOUNCES;
    sliderBounces.oninput = function(){
        bounces = this.value;
        //textNumSpheresContent.nodeValue = this.value;
    }
}

function updateHtmlElements() {
    textNumSpheresContent.nodeValue = numSpheres;
    textBouncesContent.nodeValue = bounces;
    lightingModel = dropdownModelSelection.value;
    //rotYnode.nodeValue = "ENJOY BUDDA ON A BUNNY :)"; //because Y rotation is right now disabled.
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
    scenePivot.rotate([deg2rad(deltaY / 10), deg2rad(deltaX / 10), 0]);

    lastMouseX = newX
    lastMouseY = newY;
}

function webGLStart() {
    var canvas = document.getElementById("webGLcanvas");
    //canvas.width = window.innerWidth - BROWSER_WIDTH_OFFSET;
    //canvas.height = window.innerHeight - BROWSER_HEIGHT_OFFSET;
    canvas.width = 750;
    canvas.height = 500;
    //Create the GL viewport
    initGL(canvas);
    ///Load the shaders and buffers into the GPU    
    initShaders();
    initScene()
    initTwoTriangles();
    initHtmlElements();    
    //handle mouse inputs with our callbacks
    canvas.onmousedown = handleMouseDown;
    document.onmouseup = handleMouseUp;
    document.onmousemove = handleMouseMove;
    //Set the background color to opaque black
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    //Render only pixels in front of the others.
    gl.enable(gl.DEPTH_TEST);
    //render the scene
    tick();
}

//helper functions
function deg2rad(deg) {
    return deg * Math.PI / 180;
}
function rad2deg(rad) {
    return rad / Math.PI * 180;
}

