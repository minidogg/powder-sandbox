import fs from 'node:fs'
import path from 'node:path'

// Setup raylib window
import r from 'raylib'

const screenWidth = 800
const screenHeight = 450
r.SetConfigFlags(r.FLAG_WINDOW_RESIZABLE)
r.InitWindow(screenWidth, screenHeight, "Powder Sandbox")
r.SetTargetFPS(100)

let telemetry_y = 0
function add_telemetry(text){
    r.DrawText(text, 0,telemetry_y, 20, r.LIGHTGRAY)
    telemetry_y+=25
}



// Load textures
const textures = new Map()
fs.readdirSync("textures", {recursive: true}).forEach((p)=>{
    if(!p.endsWith(".png"))return;
    let texture = r.LoadTexture(path.resolve("./textures", p))
    texture.width = 32;
    texture.height = 32;
    textures.set(p.replace(".png", "").replaceAll("\\", "/"), texture)
})
console.log(textures)


// Particle grid
let grid_width = 200;
let grid_height = 150;
let total_particles = grid_width*grid_height
let particle_grid = {}
function add_new_particle_property(name, defaultValue="", type="any"){
    switch (type) {
        case "uint8":
            particle_grid[name] = new Uint8Array(total_particles).fill(defaultValue)
            break;
        case "uint16":
            particle_grid[name] = new Uint16Array(total_particles).fill(defaultValue);
            break;
        default:
            particle_grid[name] = new Array(total_particles).fill(defaultValue)
            break;
    }
}
add_new_particle_property("type", 0, "uint16")
add_new_particle_property("r", 0, "uint8")
add_new_particle_property("g", 0, "uint8")
add_new_particle_property("b", 0, "uint8")
add_new_particle_property("a", 0, "uint8")
add_new_particle_property("life", 0, "uint8")
add_new_particle_property("tick", 0, "uint8")

let currentTick = 0
function tickParticle(i){
    particle_grid["tick"][i] = currentTick
}
function swapParticle(from, to){
    for (const key in particle_grid) {
        const arr = particle_grid[key];
        const tmp = arr[from];
        arr[from] = arr[to];
        arr[to] = tmp;
    }
    tickParticle(from)
    tickParticle(to)
}

const default_particle_handlers = {
    sand:(i, particle_type)=>{
            let below = i + grid_width
            let l = i - 1
            let r = i + 1

            // bounds:
            if (below < total_particles) {
                if (particle_types[particle_grid.type[below]]?.density < particle_type.density
                    && particle_grid.tick[i] != currentTick)
                    swapParticle(i, below)
            }

            if (below + 1 < total_particles) {
                if (particle_types[particle_grid.type[below+1]]?.density < particle_type.density
                    && particle_grid.tick[i] != currentTick)
                    swapParticle(i, below+1)
            }

            if (below - 1 >= 0) {
                if (particle_types[particle_grid.type[below-1]]?.density < particle_type.density
                    && particle_grid.tick[i] != currentTick)
                    swapParticle(i, below-1)
            }
    },
    water:(i,particle_type)=>{
        let below = (i+grid_width)
        if(particle_grid["type"][below]==0&&particle_grid["tick"][i]!=currentTick)swapParticle(i, below)
        if(particle_grid["type"][below+1]==0&&particle_grid["tick"][i]!=currentTick)swapParticle(i, below+1)
        if(particle_grid["type"][below-1]==0&&particle_grid["tick"][i]!=currentTick)swapParticle(i, below-1)
        let r = Math.round(Math.random())
        if(particle_grid["type"][i-1]==0&&particle_grid["tick"][i]!=currentTick&&r==0)swapParticle(i, i-1)
        if(particle_grid["type"][i+1]==0&&particle_grid["tick"][i]!=currentTick&&r==1)swapParticle(i, i+1)
    },
    fire:(i, particle_type)=>{
        if (particle_grid.life[i] === 0) {
            particle_grid.life[i] = 30 + Math.floor(Math.random()*20)
        }

        particle_grid.life[i]--

        if (particle_grid.life[i] <= 0) {
            particle_grid.type[i] = 0
            particle_grid.a[i] = 0
            return
        }

        const neighbors = [
            i - grid_width,
            i + grid_width,
            i - 1,
            i + 1 
        ]

        for (const n of neighbors) {
            if (n < 0 || n >= total_particles) continue
            let t = particle_types[particle_grid.type[n]]
            if (t?.flammable) {
                if (Math.random() < 0.2) {
                    particle_grid.type[n] = 2
                    particle_grid.life[n] = 40
                    particle_grid.r[n] = 255
                    particle_grid.g[n] = 80
                    particle_grid.b[n] = 10
                    particle_grid.a[n] = 255
                }
            }
        }

        let up = i - grid_width
        if (up >= 0 && particle_grid.type[up] === 0 && particle_grid.tick[i] != currentTick) {
            swapParticle(i, up)
            return
        }
        let dir = Math.random() < 0.5 ? -1 : 1
        if (particle_grid.type[i + dir] === 0 && particle_grid.tick[i] != currentTick) {
            swapParticle(i, i + dir)
        }
    }

} 

let selected_type = 2
const particle_types = [
    {
        name:"AIR",
        color: {r:0,g:0,b:0,a:0},
        tick:()=>{},
        density:0
    },
    {
        name:"WOOD",
        color: {r:168, g:98, b:50, a:255},
        tick:()=>{},
        density:9999,
        flammable:true
    },
    {
        name:"FIRE",
        color: {r:255, g:0, b:0, a:255},
        tick:default_particle_handlers.fire,
        density:9999
    },
    {
        name:"SAND",
        color: {r:255,g:255,b:0,a:255},
        tick: default_particle_handlers.sand,
        density:1.4
    },
    {
        name:"WATR",
        color: {r:0,g:0,b:255,a:255},
        tick: default_particle_handlers.water,
        density:1
    },
]


function render_particles(){
    const cols = grid_width
    const rows = grid_height

    let particle_size = Math.floor(Math.min(
        r.GetScreenWidth()  / cols,
        r.GetScreenHeight() / rows
    ))
    let offsetX = r.GetScreenWidth()/2-(cols*particle_size)/2
    r.DrawRectangleLinesEx({x:offsetX,y:-8,width:cols*particle_size+16,height:rows*particle_size*16}, 8, r.WHITE)
    for(let y = 0;y<rows;y++){
        for(let x = 0;x<cols;x++){
            let i = (y*grid_width)+x

            r.DrawRectangle(x*particle_size+8+offsetX,y*particle_size,particle_size,particle_size,{
                r:particle_grid["r"][i],
                g:particle_grid["g"][i],
                b:particle_grid["b"][i],
                a:particle_grid["a"][i],
            })
        }
    }

    let mtx = Math.round((r.GetMouseX()-offsetX-8)/particle_size)
    let mty =Math.round((r.GetMouseY())/particle_size)
    r.DrawRectangle(mtx*particle_size+offsetX+8, mty*particle_size, particle_size, particle_size, r.WHITE)
    if(r.IsMouseButtonDown(r.MOUSE_BUTTON_LEFT)){
        let mt = (mty*grid_width)+mtx

        particle_grid["r"][mt] = particle_types[selected_type].color.r
        particle_grid["g"][mt] = particle_types[selected_type].color.g
        particle_grid["b"][mt] = particle_types[selected_type].color.b
        particle_grid["a"][mt] = particle_types[selected_type].color.a
        particle_grid["type"][mt] = selected_type
    }
    // particle_grid["r"][0] = 255
    // particle_grid["a"][0] = 255
}

function tick(){
    currentTick++
    if(currentTick>5)currentTick=0
    const cols = grid_width
    const rows = grid_height
    for(let y = 0;y<rows;y++){
        for(let x = 0;x<cols;x++){
            let i = (y*grid_width)+x

            let particle_type = particle_types[particle_grid["type"][i]]
            particle_type.tick(i,particle_types[particle_grid["type"][i]])
        }
    }
}

// Render loop
const sleep = (ms)=>new Promise(r=>setTimeout(r, ms))
let last_tick = Date.now()
while (!r.WindowShouldClose()) {
    for(let i = 0;i<Math.floor((Date.now()-last_tick)/20);i++){
        tick()
        last_tick = Date.now()
    }
    telemetry_y = 0
    r.BeginDrawing();
    r.ClearBackground({r:29, g:37, b:51, a: 1})
    render_particles()


    if(r.IsKeyPressed(r.KEY_RIGHT)){
        selected_type++
        if(selected_type>=particle_types.length)selected_type = 0
    }
    if(r.IsKeyPressed(r.KEY_LEFT)){
        selected_type--
        if(selected_type<0)selected_type = 0
    }


    // r.DrawFPS(0,0)
    add_telemetry(`FPS: ${r.GetFPS()}`)
    add_telemetry(`Particle Type: ${particle_types[selected_type].name}`)
    r.EndDrawing()
}
r.CloseWindow()