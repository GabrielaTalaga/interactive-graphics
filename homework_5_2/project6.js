var raytraceFS = `
struct Ray {
    vec3 pos;
    vec3 dir;
};

struct Material {
    vec3  k_d;   
    vec3  k_s;   
    float n;    
};

struct Sphere {
    vec3     center;
    float    radius;
    Material mtl;
};

struct Light {
    vec3 position;
    vec3 intensity;
};

struct HitInfo {
    float    t;
    vec3     position;
    vec3     normal;
    Material mtl;
};

uniform Sphere spheres[ NUM_SPHERES ];
uniform Light  lights [ NUM_LIGHTS  ];
uniform samplerCube envMap;
uniform int bounceLimit;

const float EPSILON = 1e-4;

bool IntersectRay( inout HitInfo hit, Ray ray )
{
    hit.t = 1e30;
    bool foundHit = false;

    for ( int i = 0; i < NUM_SPHERES; ++i ) {
        Sphere sph = spheres[i];
        vec3 oc = ray.pos - sph.center;

        // a*t^2 + 2*b*t + c = 0, where:
        float a = dot(ray.dir, ray.dir);
        float b = dot(ray.dir, oc);
        float c = dot(oc, oc) - sph.radius * sph.radius;
        float disc = b * b - a * c;
        if ( disc > 0.0 ) {
            float sqrtDisc = sqrt(disc);

            // options:
            float t0 = (-b - sqrtDisc) / a;
            float t1 = (-b + sqrtDisc) / a;
            // smallest +
            float tCandidate = t0;
            if ( tCandidate < EPSILON ) {
                tCandidate = t1;
            }
            if ( tCandidate > EPSILON && tCandidate < hit.t ) {
                hit.t = tCandidate;
                hit.position = ray.pos + ray.dir * hit.t;
                hit.normal = normalize(hit.position - sph.center);
                hit.mtl = sph.mtl;
                foundHit = true;
            }
        }
    }
    return foundHit;
}

// Blinn-Phong + cienie
vec3 Shade( Material mtl, vec3 position, vec3 normal, vec3 view )
{
    vec3 color = vec3(0.0);
    for ( int i = 0; i < NUM_LIGHTS; ++i ) {
        Light L = lights[i];
        vec3 toLight = L.position - position;
        float distToLight = length(toLight);
        vec3 Ldir = normalize(toLight);

        // 1) Test 
        Ray shadowRay;
        shadowRay.pos = position + normal * EPSILON;
        shadowRay.dir = Ldir;

        HitInfo shadowHit;
        bool inShadow = false;
        if ( IntersectRay(shadowHit, shadowRay) ) {
            if ( shadowHit.t < distToLight ) {
                inShadow = true;
            }
        }

        if ( !inShadow ) {

            // 2) Blinn-Phong (dyfuzja + lusterko)
            float NdotL = max(dot(normal, Ldir), 0.0);
            vec3 diffuse = mtl.k_d * L.intensity * NdotL;


            vec3 halfVec = normalize(Ldir + view);
            float NdotH = max(dot(normal, halfVec), 0.0);
            vec3 specular = vec3(0.0);
            if ( NdotH > 0.0 ) {
                specular = mtl.k_s * L.intensity * pow(NdotH, mtl.n);
            }

            color += diffuse + specular;
        }
    }
    return color;
}


vec4 RayTracer( Ray ray )
{
    ray.dir = normalize(ray.dir);

    HitInfo hit;
    if ( IntersectRay(hit, ray) ) {
        vec3 view = normalize(-ray.dir);
        vec3 clr = Shade(hit.mtl, hit.position, hit.normal, view);

        vec3 currDir = ray.dir;
        vec3 currPos = hit.position;
        vec3 k_s_accum = hit.mtl.k_s;  

        for ( int bounce = 0; bounce < MAX_BOUNCES; ++bounce ) {
            if ( bounce >= bounceLimit ) break;
            if ( k_s_accum.r + k_s_accum.g + k_s_accum.b <= 0.0 ) break;

            Ray reflRay;
            reflRay.pos = currPos + hit.normal * EPSILON;
            reflRay.dir = reflect(currDir, hit.normal);
            reflRay.dir = normalize(reflRay.dir);

            HitInfo reflHit;
            if ( IntersectRay(reflHit, reflRay) ) {
                vec3 newView = normalize(-reflRay.dir);
                vec3 shaded = Shade(reflHit.mtl, reflHit.position, reflHit.normal, newView);
                clr += k_s_accum * shaded; 

                currDir = reflRay.dir;
                currPos = reflHit.position;
                hit = reflHit; 
                k_s_accum *= reflHit.mtl.k_s;  
            } else {
                vec3 envColor = textureCube(envMap, reflRay.dir.xzy).rgb;
                clr += k_s_accum * envColor;
                break;
            }
        }

        return vec4(clr, 1.0);
    } else {
        vec3 envColor = textureCube(envMap, ray.dir.xzy).rgb;
        return vec4(envColor, 0.0);
    }
}
`;
