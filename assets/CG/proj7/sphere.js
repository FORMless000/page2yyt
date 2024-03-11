/**
 * Sphere for raytracing.
 * Just the ObjectToDraw thing without buffers.
 * Might be extended to support more simple shapes.
 */
class Sphere{

    pos = [0, 0, 0];
    rot = quat.create();
    scale = [1, 1, 1];

    parent = null;
    enabled = true;

    //animation attributes
    speed = [0, 0, 0];
    rotSpeed = [0, 0, 0];
    //realistically this will have no textures?

    color = [0.9, 0.9, 1];
    radius = 1;

    subObjects = [];

    init(x, y, z, radius = 1) {
        this.pos = [x, y, z];
        this.radius = radius;
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

    tick(deltatime) {
        this.preTick(deltatime);

        this.pos[0] += deltatime * this.speed[0] / 1000;
        this.pos[1] += deltatime * this.speed[1] / 1000;
        this.pos[2] += deltatime * this.speed[2] / 1000;
        //console.log("rotate");

        this.rot = quat.rotateZ(this.rot, this.rot, deltatime * this.rotSpeed[2] / 1000);
        this.rot = quat.rotateX(this.rot, this.rot, deltatime * this.rotSpeed[0] / 1000);
        this.rot = quat.rotateY(this.rot, this.rot, deltatime * this.rotSpeed[1] / 1000);
        //this.rotate(this.rot);

        for (let obj of this.subObjects) {
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


}