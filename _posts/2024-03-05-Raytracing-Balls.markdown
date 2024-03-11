---
layout: post
title:  "Default example page from Jekyll"
date:   2024-03-05 22:00:08 -0500
categories: jekyll update
---
You’ll find this post in your `_posts` directory. Go ahead and edit it and re-build the site to see your changes. You can rebuild the site in many different ways, but the most common way is to run `jekyll serve`, which launches a web server and auto-regenerates your site when a file is updated.

Jekyll requires blog post files to be named according to the following format:

`YEAR-MONTH-DAY-title.MARKUP`

Where `YEAR` is a four-digit number, `MONTH` and `DAY` are both two-digit numbers, and `MARKUP` is the file extension representing the format used in the file. After that, include the necessary front matter. Take a look at the source for this post to get an idea about how it works.

Jekyll also offers powerful support for code snippets:

{% highlight ruby %}
def print_hi(name)
  puts "Hi, #{name}"
end
print_hi('Tom')
#=> prints 'Hi, Tom' to STDOUT.
{% endhighlight %}

Check out the [Jekyll docs][jekyll-docs] for more info on how to get the most out of Jekyll. File all bugs/feature requests at [Jekyll’s GitHub repo][jekyll-gh]. If you have questions, you can ask them on [Jekyll Talk][jekyll-talk].

[jekyll-docs]: https://jekyllrb.com/docs/home
[jekyll-gh]:   https://github.com/jekyll/jekyll
[jekyll-talk]: https://talk.jekyllrb.com/


<html>
<head>
    <title>PROJECT 7 (Raytracer)</title>
    <style>
        .container {
            position: relative;
        }

        #overlay {
            position: absolute;
            left: 10px;
            top: 10px;
            color: white;
        }
    </style>

    <script type="text/javascript" src="../../../../../assets/CG/lib/gl-matrix-3.4.0min.js"></script>
    <script type="text/javascript" src="../../../../../assets/CG/lib/webglutils.js"></script>

    <script id="shader-fs" type="x-shader/x-fragment">
        ////////////////////////////////////////////////////////
        ///FRAGMENT SHADER START
        ////////////////////////////////////////////////////////
        precision mediump float;
        struct Sphere{
            bool enabled;
            vec3 position;
            vec3 color;
            float radius;
        };
        uniform Sphere uSpheres[16];
        uniform int uNumSpheres;
        uniform int uBounces;        
        uniform int uLightingModel;//0-phong, 1-mirror, 2-debugger. All stuff always calculated for convenience.

        varying vec3 vPosition;

        float vecSqr(vec3 c){ //save some letters while coding
            return dot(c,c);
        }
        vec3 posFromRay(vec3 r0, vec3 rd, float t){
           return r0 + rd * t;
        }
        //helper to retrieve color from spheres
        vec3 getSphereColor(int id){
            for (int i=0; i<16; ++i){
                if (i>=uNumSpheres){
                    break;
                }
                if (i == id){
                    return uSpheres[i].color;
                }
            }
            return vec3(0.0, 0.0, 0.0);
        }
        // Given an arbitrary ray and sphere, determine the distance to the intersection if it exists, or return infinity otherwise.
        float raySphereIntersect(vec3 r0, vec3 rd, vec3 s0, float sr) {
            float a = vecSqr(rd);
            float b = 2.0 * dot(rd, (r0 - s0));
            float c = vecSqr(r0 - s0) - sr * sr;
            float b2m4ac = b*b - 4.0*a*c;
            float solution = 0.0;
            if (b2m4ac < 0.0){
                return 999999.0;
            }else{
                //only positive solutions are valid.
                //try get the lesser solution first.
                solution = -(b + sqrt(b2m4ac)) / (a * 2.0);
                //if negative, try the greater one.
                if(solution <= 0.0){
                    solution = -(b - sqrt(b2m4ac)) / (a * 2.0);
                }
                if(solution <= 0.0){
                    return 999999.0;
                }
            }
            return solution;
        }
        //function to test ray against all objects.
        float rayTest(vec3 r0, vec3 rd, out int objectIntersected, out vec3 positionAtIntersection, out vec3 normalAtIntersection){
            float dist = 999999.0;
            objectIntersected = -1;
            for (int i=0; i<16; ++i){
                if (i > uNumSpheres){
                    break;
                }
                if (uSpheres[i].enabled){
                    float t = raySphereIntersect(r0, rd, uSpheres[i].position, uSpheres[i].radius);
                    if(dist > t){
                        dist = t;
                        objectIntersected = i;
                        positionAtIntersection = r0 + dist*rd;
                        normalAtIntersection = normalize(positionAtIntersection - uSpheres[i].position);
                    }
                }
            }
            return dist;
        }

        void main(void) {
            //float infinity = 999999.0;
            vec3 origin = vec3(0.0, 0.0, 2.0); //origin of all rays. Implicitly controls the FOV. positive Z out from the screen, so stuff with negative Z renders.
            vec3 direction = normalize(vPosition - origin);
            origin = vPosition;

            vec3 finalColor = vec3(0.0, 0.0, 0.0);

            //temp values for a quick test. Maybe for the final project? Depends on how lazy I am.
            vec3 lightingDirection = normalize(vec3(1.0, 1.0, 2.0));
            float diffusal = 0.25;      //material costant
            float specularity = 1.0;    //mashed material constant
            float specularPower = 3.0;  //power constant
            float reflectiveness = 1.0;
            if(uLightingModel == 3){
                reflectiveness = 0.33;
            }
            
            float reflectPortion = 1.0; //multiplicativly accumulative
            vec3 ambience = vec3(0.05, 0.05, 0.05);

            int objectIntersected;
            vec3 positionAtIntersection;
            vec3 normalAtIntersection;

            vec3 testAllReflectionOnlyLighting = vec3(0.0, 0.0, 0.0);

            vec3 diffAmb = vec3(0.0, 0.0, 0.0);

            float what; //debugging variable
            rayTest(origin, direction, objectIntersected, positionAtIntersection, normalAtIntersection);
            if(objectIntersected != -1){//intersected
                //TODO LIGHTING
                vec3 sphereColor = getSphereColor(objectIntersected);
                diffAmb = vec3(0.0, 0.0, 0.0);
                diffAmb += ambience * sphereColor;
                diffAmb += max(dot(normalAtIntersection, lightingDirection), 0.0) * diffusal * sphereColor;//diffusal
                testAllReflectionOnlyLighting += diffAmb;
                vec3 ref = normalize(reflect(lightingDirection, normalAtIntersection));
                finalColor = pow(max(dot(direction, ref), 0.0), specularPower) * specularity * sphereColor + diffAmb;
                //finalCo
                //finalColor = normalAtIntersection;
                what = 0.1;
                //after first intersection, let's get bouncing!
                for (int i=0; i<10; ++i){
                    direction = normalize(reflect(direction, normalAtIntersection));
                    if (i >= uBounces){
                        testAllReflectionOnlyLighting += pow(max(dot(direction, lightingDirection), 0.0), specularPower) * sphereColor;
                        break;
                    }
                    origin = positionAtIntersection;
                    objectIntersected = -1;
                    positionAtIntersection = vec3(0.0, 0.0, 0.0);
                    normalAtIntersection = vec3(0.0, 0.0, 0.0);
                    //0.005 to prevent self-intersection. Could be done with extra parameter, but this just works.
                    rayTest(origin + 0.005 * direction, direction, objectIntersected, positionAtIntersection, normalAtIntersection);
                    if(objectIntersected != -1){
                        sphereColor = getSphereColor(objectIntersected);
                        diffAmb = vec3(0.0, 0.0, 0.0);
                        vec3 localColor = vec3(0.0, 0.0, 0.0);
                        diffAmb += ambience * sphereColor;
                        diffAmb += max(dot(normalAtIntersection, lightingDirection), 0.0) * diffusal * sphereColor;//diffusal
                        testAllReflectionOnlyLighting += diffAmb;
                        vec3 localRef = normalize(reflect(lightingDirection, normalAtIntersection));
                        localColor = pow(max(dot(direction, localRef), 0.0), specularPower) * specularity * sphereColor + diffAmb;
                        reflectPortion *= reflectiveness;
                        finalColor += localColor * reflectPortion;


                        //TODO LIGHTING
                        what += 0.2;
                    }else{//no intersection
                        testAllReflectionOnlyLighting += pow(max(dot(direction, lightingDirection), 0.0), specularPower) * sphereColor;
                        break;
                    }
                }
            }else{//no intersection
                what = 0.0;
            }

            //0-phong, 1-mirror, 2-debugger. All stuff always calculated for convenience.
            if(uLightingModel == 1){
                gl_FragColor = vec4(testAllReflectionOnlyLighting, 1.0);
            } else if (uLightingModel == 2){
                gl_FragColor = vec4(0.0,what,0.0, 1.0);
            } else {
                gl_FragColor = vec4(finalColor, 1.0);
            }
            
        }
        ////////////////////////////////////////////////////////
        ///FRAGMENT SHADER END
        ////////////////////////////////////////////////////////
    </script>
    <script id="shader-vs" type="x-shader/x-vertex">
        //////////////////////////////////////////////////////
        ///VERTEX SHADER START
        //////////////////////////////////////////////////////
        ///Attributes are inputs provided for each vertex,
        ///different for each vertex in the rendering call
        ///input: vertex position
        precision mediump float;
        attribute vec3 aVertexPosition;
        varying vec3 vPosition;
        uniform mat4 uMVMatrix; //?
        uniform mat4 uPMatrix; //?
            
        //Uniforms are inputs provided for ALL Vertices, 
        //the same for all vertices in any rendering call
        void main(void) {
            gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
            vPosition = aVertexPosition;
        }
        //////////////////////////////////////////////////////
        ///VERTEX SHADER END
        //////////////////////////////////////////////////////
    </script>

    <script type="text/javascript" src="../../../../../assets/CG/proj7/sphere.js"> </script>
    <script type="text/javascript" src="../../../../../assets/CG/proj7/app-proj7.js"> </script>

</head>
<body onload="webGLStart();">
    <canvas id="webGLcanvas" style="border: none;">
    </canvas>

    <div id="overlay">
        <div> ...<span id="random"></span></div>
    </div>
    <BR><BR>
        <div>
            Number of Spheres:
            <input type="range" min="1" max="16" value="16" id="numSphereSlider">
            <span id="numSphereText"></span>
        </div>
        <div>
            Ray Bounces:
            <input type="range" min="0" max="16" value="16" id="BouncesSlider">
            <span id="BouncesText"></span>
        </div>
        

    <input type="checkbox" id="pause"  />Pause Animation<br />

    <label for="lightingModel">Lighting Model:</label>

    <select name="lightingModel" id="lightingModel">
        <option value=0>Accumulative Phong (prompted)</option>
        <option value=3>Accumulative Phong Less reflection (*0.33)</option>
        <option value=1>Reflection as Specularity</option>
        <option value=2>Ray Reflection Debugging</option>
    </select>

</body>
</html>

