class ObjectToDraw {


    //GL buffers for the sphere to draw
    vertexPosBuffer = [];
    vertexColBuffer = [];
    vertexTextureCoordBuffer = [];
    vertexNormalCoordBuffer = [];

    drawMode = gl.TRIANGLES;

    pos = [0, 0, 0];
    rot = quat.create();
    scale = [1, 1, 1];

    useLighting = 1;
    useTexture = 0;
    diffusion = 0.5;
    specularity = 1;

    texture = null;
    parent = null;
    shader = null;

    enabled = true;

    //animation attributes
    speed = [0, 0, 0];
    rotSpeed = [0, 0, 0];

    subObjects = [];

    init() {
        throw new Error("Method 'init()' must be implemented.");
    }

    push(sub) {
        sub.parent = this;
        this.subObjects.push(sub);
    }

    rotate(vector3xyz) {//ZXY
        this.rot = quat.rotateZ(this.rot, this.rot, vector3xyz[2]);
        this.rot = quat.rotateX(this.rot, this.rot, vector3xyz[0]);
        this.rot = quat.rotateY(this.rot, this.rot, vector3xyz[1]);
    }
    rotateX(rad) { this.rot = quat.rotateX(this.rot, this.rot, rad); }
    rotateY(rad) { this.rot = quat.rotateY(this.rot, this.rot, rad); }
    rotateZ(rad) { this.rot = quat.rotateZ(this.rot, this.rot, rad); }

    setTexture(texture) {
        this.texture = texture;
        this.useTexture = 1;
    }

    tick(deltatime) {
        this.preTick(deltatime);

        this.pos[0] += deltatime * this.speed[0] / 1000;
        this.pos[1] += deltatime * this.speed[1] / 1000;
        this.pos[2] += deltatime * this.speed[2] / 1000;

        this.rot = quat.rotateZ(this.rot, this.rot, deltatime * this.rotSpeed[2] / 1000);
        this.rot = quat.rotateX(this.rot, this.rot, deltatime * this.rotSpeed[0] / 1000);
        this.rot = quat.rotateY(this.rot, this.rot, deltatime * this.rotSpeed[1] / 1000);
        //this.rotate(this.rot);

        for (obj of this.subObjects) {
            obj.tick(deltatime);
        }

        this.postTick(deltatime);
    }

    //functions to be overrided
    preTick(deltaTime){}
    postTick(deltaTime){}

    //require glmatrix
    worldPos(){
        return this.worldPosRotScale()[0];
    }

    //try to fix worldpos only taking 1 level of rotations and scales.
    worldPosRotScale(){
        if(this.parent){
            let parentTransform = this.parent.worldPosRotScale();
            let parentWorldPos = parentTransform[0];
            let parentRot = parentTransform[1];
            let parentScale = parentTransform[2];
            let posVec = vec3.fromValues(this.pos[0], this.pos[1], this.pos[2]);
            posVec = vec3.transformQuat(posVec, posVec, parentRot);
            posVec = vec3.multiply(posVec, posVec, parentScale);
            posVec = vec3.add(posVec, posVec, parentWorldPos);
            let combRot = quat.create();
            combRot = quat.multiply(combRot, parentRot, this.rot);
            let combScale = vec3.create();
            combScale = vec3.multiply(combScale, parentScale, this.scale);
            return [posVec, combRot, combScale];
        }else{
            return [this.pos, this.rot, this.scale];
        }
    }

    copyFrom(obj){
        this.vertexPosBuffer = obj.vertexPosBuffer;
        this.vertexColBuffer = obj.vertexColBuffer;
        this.vertexTextureCoordBuffer = obj.vertexTextureCoordBuffer;
        this.vertexNormalCoordBuffer = obj.vertexNormalCoordBuffer;
    }

}

class SphereToDraw extends ObjectToDraw {
    //now textureless
    init(slices = 25, stacks = 12, sRadius = 1, color = [0.95, 0.95, 1]) {
        this.drawMode = gl.TRIANGLES;
        const PointForSphere = class {
            pos = [0, 0, 0];
            color = [1, 1, 1, 1];
            texUV = [0, 0];
            Normal = [0, 0, 0];
            constructor(radius, theta, phi) {
                var xVal = radius * Math.cos(theta) * Math.sin(phi);
                var yVal = radius * Math.sin(theta) * Math.sin(phi);
                var zVal = radius * Math.cos(phi);
                this.pos = [xVal, yVal, zVal];
                this.texUV = [theta / 2 / Math.PI, phi / Math.PI];
            }

        }
        let sVertices = [];
        let sColors = [];
        let sTextureCoords = [];
        let sNormal = [];
        let count = 0;
        for (let t = 0; t < stacks; t++) { // stacks are ELEVATION so they count theta
            var phi1 = ((t) / stacks) * Math.PI;
            var phi2 = ((t + 1) / stacks) * Math.PI;
            for (let p = 0; p < slices; p++) {
                var theta1 = ((p) / slices) * 2 * Math.PI;
                var theta2 = ((p + 1) / slices) * 2 * Math.PI;
                //point 1, 2, 3, 2, 3, 4
                let points = [new PointForSphere(sRadius, theta1, phi1), new PointForSphere(sRadius, theta1, phi2), new PointForSphere(sRadius, theta2, phi1),
                new PointForSphere(sRadius, theta1, phi2), new PointForSphere(sRadius, theta2, phi1), new PointForSphere(sRadius, theta2, phi2)];
                var xNor = Math.cos((theta1 + theta2) / 2) * Math.sin((phi1 + phi2) / 2);
                var yNor = Math.sin((theta1 + theta2) / 2) * Math.sin((phi1 + phi2) / 2);
                var zNor = Math.cos((phi1 + phi2) / 2);
                let normal = [xNor, yNor, zNor];
                //concat into buffer-to-be arrays (1,2,3) (2,3,4)
                for (let i = 0; i < 6; ++i) {
                    sVertices = sVertices.concat(points[i].pos);
                    sColors = sColors.concat(color); // attach color
                    sColors = sColors.concat([1]); // color missing alpha
                    sTextureCoords = sTextureCoords.concat(points[i].texUV);
                    sNormal = sNormal.concat(normal);
                }
                count++;
            }
        }

        this.vertexPosBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexPosBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sVertices), gl.STATIC_DRAW);
        this.vertexPosBuffer.itemSize = 3;
        this.vertexPosBuffer.numItems = count * 6;

        this.vertexColBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexColBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sColors), gl.STATIC_DRAW);
        this.vertexColBuffer.itemSize = 4;
        this.vertexColBuffer.numItems = count * 6;

        this.vertexTextureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexTextureCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sTextureCoords), gl.STATIC_DRAW);
        this.vertexTextureCoordBuffer.itemSize = 2;
        this.vertexTextureCoordBuffer.numItems = count * 6;

        //what do this line do?
        //gl.bindBuffer(gl.ARRAY_BUFFER, null);

        this.vertexNormalCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexNormalCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sNormal), gl.STATIC_DRAW);
        this.vertexNormalCoordBuffer.itemSize = 3;
        this.vertexNormalCoordBuffer.numItems = count * 6;
    }





}

//extra credit work here
class OrbitToDraw extends ObjectToDraw {

    init(radius, dashLength = 0.1, dashColor = [0.5, 0.5, 0.5, 1]) {
        let slices = Math.round(radius * Math.PI / dashLength);

        this.useLighting = 0;
        this.useTexture = 0;
        this.drawMode = gl.LINES;

        let sVertices = [];
        let sColors = [];
        let sTextureCoords = [];
        let sNormal = [];
        let count = 0;


        for (let t = 0; t < slices; ++t) { //do it EVEN times.
            let theta1 = (t / slices) * Math.PI * 2;
            let theta2 = ((t + 0.5) / slices) * Math.PI * 2;
            let xDash = Math.cos(theta1) * radius;
            let zDash = Math.sin(theta1) * radius;
            let yDash = 0;
            sVertices = sVertices.concat([xDash, yDash, zDash]);
            sColors = sColors.concat(dashColor);
            sTextureCoords = sTextureCoords.concat([0, 0]);
            sNormal = sNormal.concat([0, 1, 0]);

            xDash = Math.cos(theta2) * radius;
            zDash = Math.sin(theta2) * radius;
            yDash = 0;
            sVertices = sVertices.concat([xDash, yDash, zDash]);
            sColors = sColors.concat(dashColor);
            sTextureCoords = sTextureCoords.concat([0, 0]);
            sNormal = sNormal.concat([0, 1, 0]);

            count += 2;
        }

        this.vertexPosBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexPosBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sVertices), gl.STATIC_DRAW);
        this.vertexPosBuffer.itemSize = 3;
        this.vertexPosBuffer.numItems = count;

        this.vertexColBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexColBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sColors), gl.STATIC_DRAW);
        this.vertexColBuffer.itemSize = 4;
        this.vertexColBuffer.numItems = count;

        this.vertexTextureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexTextureCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sTextureCoords), gl.STATIC_DRAW);
        this.vertexTextureCoordBuffer.itemSize = 2;
        this.vertexTextureCoordBuffer.numItems = count;

        //what do this line do?
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        this.vertexNormalCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexNormalCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sNormal), gl.STATIC_DRAW);
        this.vertexNormalCoordBuffer.itemSize = 3;
        this.vertexNormalCoordBuffer.numItems = count;

    }
}

class LineToDraw extends ObjectToDraw{
    init(startPos, endPos, dashLength = 0.1, dashColor = [0.5, 0.5, 0.5, 1]) {
        //this.pos = startPos;
        let len = Math.sqrt(vec3.sqrDist(startPos, endPos));
        let slices = Math.round(len / dashLength / 2);


        this.useLighting = 0;
        this.useTexture = 0;
        this.drawMode = gl.LINES;

        let sVertices = [];
        let sColors = [];
        let sTextureCoords = [];
        let sNormal = [];
        let count = 0;


        for (let i = 0; i < slices; ++i) {
            let s = i/slices;   //why *2? I don't get it. but it just works.
            let t = (i+0.5)/slices;
            let xDash = startPos[0] + (endPos[0] - startPos[0]) * s;
            let yDash = startPos[1] + (endPos[1] - startPos[1]) * s;
            let zDash = startPos[2] + (endPos[2] - startPos[2]) * s;
            sVertices = sVertices.concat([xDash, yDash, zDash]);
            sColors = sColors.concat(dashColor);
            sTextureCoords = sTextureCoords.concat([0, 0]);
            sNormal = sNormal.concat([0, 1, 0]);
            

            xDash = startPos[0] + (endPos[0] - startPos[0]) * t;
            yDash = startPos[1] + (endPos[1] - startPos[1]) * t;
            zDash = startPos[2] + (endPos[2] - startPos[2]) * t;
            sVertices = sVertices.concat([xDash, yDash, zDash]);
            sColors = sColors.concat(dashColor);
            sTextureCoords = sTextureCoords.concat([0, 0]);
            sNormal = sNormal.concat([0, 1, 0]);

            count += 2;
        }

        this.vertexPosBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexPosBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sVertices), gl.STATIC_DRAW);
        this.vertexPosBuffer.itemSize = 3;
        this.vertexPosBuffer.numItems = count;

        this.vertexColBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexColBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sColors), gl.STATIC_DRAW);
        this.vertexColBuffer.itemSize = 4;
        this.vertexColBuffer.numItems = count;

        this.vertexTextureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexTextureCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sTextureCoords), gl.STATIC_DRAW);
        this.vertexTextureCoordBuffer.itemSize = 2;
        this.vertexTextureCoordBuffer.numItems = count;

        //what do this line do?
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        this.vertexNormalCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexNormalCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sNormal), gl.STATIC_DRAW);
        this.vertexNormalCoordBuffer.itemSize = 3;
        this.vertexNormalCoordBuffer.numItems = count;

    }
}





class ObjectLight extends ObjectToDraw{
    //shall never take buffers
    isDirectional = false;
    color = [0.7, 0.7, 0.8];
    fade = 0;
    worldPos(){
        if(this.isDirectional){
            return this.pos;
        }else{
            return super.worldPos();
        }
    }
    init(isDirectional = false, position = [0,0,0], color = [0.7, 0.7, 0.8], fade = 0){
        this.isDirectional = isDirectional;
        this.pos = position;
        this.color = color;
        this.fade = fade;
    }
}



class MacToDraw extends ObjectToDraw {
    //now textureless
    init(slices = 25, stacks = 12, sRadius = 1, color = [0.95, 0.95, 1], fullness = 0.5, innerRadiusRatio = 0.2) {
        this.drawMode = gl.TRIANGLES;
        const PointForMac = class {
            pos = [0, 0, 0];
            color = [1, 1, 1, 1];
            texUV = [0, 0];
            normal = [0, 0, 0];
            constructor(origin, radius, theta, phi) {
                /*
                let sliceCenter1 = [wholeRadius * Math.cos(theta1), 0, wholeRadius * Math.sin(theta1)];
                let sliceCenter2 = [wholeRadius * Math.cos(theta2), 0, wholeRadius * Math.sin(theta2)];
                */
                var extension = Math.cos(phi) * radius;
                var xVal = origin[0] + extension * Math.cos(theta);
                var yVal = radius * Math.sin(phi);
                var zVal = origin[2] + extension * Math.sin(theta);
                this.pos = [xVal, yVal, zVal];
                var localNormal = [Math.cos(phi),Math.sin(phi),0];
                //rotate this normal along Y axis.
                var xNorm = Math.cos(phi) * Math.cos(theta);
                var zNorm = Math.cos(phi) * Math.sin(theta);
                this.normal = [xNorm, Math.sin(phi), zNorm];
                //console.log(this.normal);

            }

        }
        let sVertices = [];
        let sColors = [];
        let sTextureCoords = [];
        let sNormal = [];
        let count = 0;
        /*
        for (let t = 0; t < stacks; t++) { // stacks are ELEVATION so they count theta
            var phi1 = ((t) / stacks) * Math.PI;
            var phi2 = ((t + 1) / stacks) * Math.PI;
            for (let p = 0; p < slices; p++) {
                var theta1 = ((p) / slices) * 2 * Math.PI;
                var theta2 = ((p + 1) / slices) * 2 * Math.PI;
                //point 1, 2, 3, 2, 3, 4
                let points = [new PointForSphere(sRadius, theta1, phi1), new PointForSphere(sRadius, theta1, phi2), new PointForSphere(sRadius, theta2, phi1),
                new PointForSphere(sRadius, theta1, phi2), new PointForSphere(sRadius, theta2, phi1), new PointForSphere(sRadius, theta2, phi2)];
                var xNor = Math.cos((theta1 + theta2) / 2) * Math.sin((phi1 + phi2) / 2);
                var yNor = Math.sin((theta1 + theta2) / 2) * Math.sin((phi1 + phi2) / 2);
                var zNor = Math.cos((phi1 + phi2) / 2);
                let normal = [xNor, yNor, zNor];
                //concat into buffer-to-be arrays (1,2,3) (2,3,4)
                for (let i = 0; i < 6; ++i) {
                    sVertices = sVertices.concat(points[i].pos);
                    sColors = sColors.concat(color); // attach color
                    sColors = sColors.concat([1]); // color missing alpha
                    sTextureCoords = sTextureCoords.concat(points[i].texUV);
                    sNormal = sNormal.concat(normal);
                }
                count++;
            }
        }
        */
        let slicesToDraw = Math.round(slices * fullness);
        let innerRadius = sRadius * innerRadiusRatio;
        let wholeRadius = (sRadius + innerRadius) / 2;
        let sliceRadius = sRadius - wholeRadius;
        for (let p = 0; p < slicesToDraw; p++) { // stacks are ELEVATION so they count theta
            var theta1 = ((p) / slices) * 2 * Math.PI;
            var theta2 = ((p + 1) / slices) * 2 * Math.PI;
            let sliceCenter1 = [wholeRadius * Math.cos(theta1), 0, wholeRadius * Math.sin(theta1)];
            let sliceCenter2 = [wholeRadius * Math.cos(theta2), 0, wholeRadius * Math.sin(theta2)];
            for (let t = 0; t < stacks; t++) {
                var phi1 = ((t) / stacks) * 2 *Math.PI;
                var phi2 = ((t + 1) / stacks) * 2 *Math.PI;
                //get moved points from sliceCenters. 6 points total.
                let points = [  new PointForMac(sliceCenter1, sliceRadius, theta1, phi1), 
                                new PointForMac(sliceCenter1, sliceRadius, theta1, phi2),
                                new PointForMac(sliceCenter2, sliceRadius, theta2, phi1),
                                new PointForMac(sliceCenter1, sliceRadius, theta1, phi2),
                                new PointForMac(sliceCenter2, sliceRadius, theta2, phi1),
                                new PointForMac(sliceCenter2, sliceRadius, theta2, phi2)
                ];
                for (let i = 0; i < 6; ++i) {
                    sVertices = sVertices.concat(points[i].pos);
                    sColors = sColors.concat(color); // attach color
                    sColors = sColors.concat([1]); // color missing alpha
                    sTextureCoords = sTextureCoords.concat(points[i].texUV);
                    sNormal = sNormal.concat(points[i].normal);
                }

                count++;
            }
        }

        this.vertexPosBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexPosBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sVertices), gl.STATIC_DRAW);
        this.vertexPosBuffer.itemSize = 3;
        this.vertexPosBuffer.numItems = count * 6;

        this.vertexColBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexColBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sColors), gl.STATIC_DRAW);
        this.vertexColBuffer.itemSize = 4;
        this.vertexColBuffer.numItems = count * 6;

        this.vertexTextureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexTextureCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sTextureCoords), gl.STATIC_DRAW);
        this.vertexTextureCoordBuffer.itemSize = 2;
        this.vertexTextureCoordBuffer.numItems = count;

        this.vertexNormalCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexNormalCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sNormal), gl.STATIC_DRAW);
        this.vertexNormalCoordBuffer.itemSize = 3;
        this.vertexNormalCoordBuffer.numItems = count * 6;
    }

    copyFromWithNewColor(obj, color){
        this.vertexPosBuffer = obj.vertexPosBuffer;
        this.vertexTextureCoordBuffer = obj.vertexTextureCoordBuffer;
        this.vertexNormalCoordBuffer = obj.vertexNormalCoordBuffer;

        let count = obj.vertexPosBuffer.numItems;
        let sColors = [];
        for (let i=0;i<count;++i){
            sColors = sColors.concat(color); 
            sColors = sColors.concat([1]); 
        }
        this.vertexColBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexColBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sColors), gl.STATIC_DRAW);
        this.vertexColBuffer.itemSize = 4;
        this.vertexColBuffer.numItems = count * 6;

    }



}