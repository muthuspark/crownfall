"""Generate original villager art. Run with Python 3.11 + bpy==4.3.0 + Pillow.
Eight directions (screen clockwise from right), eight frames, seven actions.
No external models, textures, or licensed artwork are used.
"""
import bpy, math
from mathutils import Vector
from PIL import Image
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'public' / 'art'
OUT.mkdir(parents=True, exist_ok=True)
TILE = 96
ACTIONS = ['idle', 'walk', 'chop', 'mine', 'carry', 'build', 'gather']

def material(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    return m

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
M = {k: material(k, v) for k, v in {
    'skin': (.59,.36,.21), 'skinlight': (.75,.51,.32),
    'linen': (.59,.52,.36), 'sleeve': (.69,.61,.43),
    'trousers': (.22,.23,.18), 'leather': (.16,.095,.052),
    'hair': (.105,.061,.035), 'wood': (.32,.20,.09),
    'metal': (.35,.39,.40), 'sack': (.46,.34,.17),
    'team': (.15,.34,.52),
}.items()}
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = False
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.resolution_x = scene.render.resolution_y = TILE * 8
scene.render.resolution_percentage = 100
scene.world.color = (.45,.45,.45)
scene.view_settings.view_transform = 'Standard'
scene.render.threads_mode = 'FIXED'
scene.render.threads = 8
# Camera projection matches the game's 2:1 isometric ground plane.
view = Vector((0,-1,.8660254)).normalized()
right = Vector((1,0,0))
up = view.cross(right).normalized()
span = 2.6
bpy.ops.object.camera_add(location=view * 40)
cam = bpy.context.object
cam.rotation_euler = (-view).to_track_quat('-Z','Y').to_euler()
cam.data.type = 'ORTHO'
cam.data.ortho_scale = span * 8
scene.camera = cam
for loc, energy in [((-8,-12,20),2.2),((12,0,8),.7)]:
    bpy.ops.object.light_add(type='SUN', location=loc)
    light = bpy.context.object
    light.data.energy = energy
    light.data.angle = .25
    light.rotation_euler = (-light.location).to_track_quat('-Z','Y').to_euler()

roots = []

# Shared mesh prototypes keep the atlas small and the generator fast.
meshes = {}
def sphere(root, name, p, scale, mat):
    key = ('sphere', mat)
    if key not in meshes:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=1)
        proto = bpy.context.object
        mesh = proto.data
        mesh.materials.append(M[mat])
        for f in mesh.polygons: f.use_smooth = True
        bpy.data.objects.remove(proto, do_unlink=True)
        meshes[key] = mesh
    o = bpy.data.objects.new(name, meshes[key])
    scene.collection.objects.link(o)
    o.parent = root
    o.location = p
    o.scale = scale
    return o

def bone(root, a, b, radius, mat, end=None):
    ratio = round((end or radius*.8)/radius, 4)
    key = ('bone', ratio, mat)
    if key not in meshes:
        bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=1, radius2=ratio, depth=1)
        proto = bpy.context.object
        mesh = proto.data
        mesh.materials.append(M[mat])
        for f in mesh.polygons: f.use_smooth = True
        bpy.data.objects.remove(proto, do_unlink=True)
        meshes[key] = mesh
    delta = Vector(b)-Vector(a)
    o=bpy.data.objects.new('limb or tool', meshes[key])
    scene.collection.objects.link(o)
    o.parent=root
    o.location=(Vector(a)+Vector(b))/2
    o.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
    o.scale=(radius,radius,delta.length)
    return o

def person(action, frame, direction, offset):
    root=bpy.data.objects.new('villager',None)
    scene.collection.objects.link(root)
    roots.append(root)
    root.location=offset
    root.scale=(1.12,1.12,1.12)
    # Our character faces local -Y. Orthographic vertical foreshortening is
    # accounted for so all eight rows face the expected screen direction.
    angle=direction*math.tau/8
    dx, dy=math.cos(angle), -math.sin(angle)/up.y
    root.rotation_euler.z=math.atan2(dx,-dy)
    phase=frame*math.tau/8
    walking=action in ('walk','carry')
    stride=math.sin(phase)*.23 if walking else 0
    bob=abs(math.cos(phase))*.025 if walking else math.sin(phase)*.008
    work=action in ('chop','mine','build','gather')
    lean=(.10+.08*math.sin(phase)) if work else 0
    hips=.87+bob
    for side in (-1,1):
        x=side*.105
        swing=stride*side
        knee=(x,-swing*.5,.46+bob)
        ankle=(x,swing,.10+max(0,-swing)*.26)
        bone(root,(x,0,hips),knee,.074,'trousers',.059)
        bone(root,knee,ankle,.057,'trousers',.044)
        sphere(root,'boot',(x,ankle[1]-.045,ankle[2]-.035),(.069,.13,.065),'leather')
    # Tunic, belt and shoulders follow a subtly forward-leaning torso.
    sphere(root,'tunic',(0,-lean*.45,1.12+bob),(.215,.135,.32),'linen')
    sphere(root,'tunic hem',(0,0,.90+bob),(.226,.15,.13),'linen')
    sphere(root,'belt',(0,-lean*.2,.99+bob),(.218,.146,.034),'leather')
    sphere(root,'team sash',(0,-.133-lean*.6,1.22+bob),(.135,.018,.18),'team')
    sphere(root,'team vest back',(0,.122-lean*.6,1.23+bob),(.145,.018,.19),'team')
    bone(root,(.10,-.02,1.42+bob),(-.10,-.15-lean,1.02+bob),.035,'team',.035)
    bone(root,(0,-lean,1.38+bob),(0,-lean,1.49+bob),.057,'skin')
    head=(0,-lean,1.60+bob)
    sphere(root,'head',head,(.099,.096,.133),'skinlight')
    sphere(root,'hair',(0,.018-lean,1.66+bob),(.103,.096,.081),'hair')
    sphere(root,'nose',(0,-.10-lean,1.59+bob),(.025,.036,.029),'skinlight')
    for s in (-1,1):
        sphere(root,'ear',(s*.099,-lean,1.59+bob),(.023,.027,.037),'skin')
        sphere(root,'eye',(s*.038,-.088-lean,1.625+bob),(.009,.008,.009),'hair')
    sphere(root,'chin',(0,-.043-lean,1.52+bob),(.066,.058,.035),'skin')
    hands=[]
    for s in (-1,1):
        shoulder=(s*.205,-lean*.7,1.36+bob)
        if action=='carry':
            elbow=(s*.265,-.16,1.13+bob)
            hand=(s*.16,-.35,1.13+bob)
        elif work:
            lift=(math.sin(phase)+1)/2
            elbow=(s*.24,-.18-lean,1.18+lift*.19+bob)
            hand=(s*.09,-.38-lean,1.12+lift*.49+bob)
            if action=='gather': hand=(s*.14,-.37,1.02+lift*.14+bob)
        else:
            swing=-stride*s*.65
            elbow=(s*.24,swing*.6,1.12+bob)
            hand=(s*.22,swing, .91+bob)
        bone(root,shoulder,elbow,.073,'sleeve',.056)
        bone(root,elbow,hand,.048,'skin',.032)
        sphere(root,'hand',hand,(.040,.038,.048),'skinlight')
        hands.append(Vector(hand))
    grip=(hands[0]+hands[1])/2
    if action=='carry':
        sphere(root,'sack',(0,-.36,1.13+bob),(.19,.16,.20),'sack')
        bone(root,(-.16,-.37,1.27+bob),(.16,-.37,1.27+bob),.018,'wood')
    elif action in ('chop','mine','build'):
        lift=(math.sin(phase)+1)/2
        tip=grip+Vector((0,-.22+lift*.38,.10+lift*.36))
        butt=grip-(tip-grip)*.65
        bone(root,butt,tip,.018,'wood',.018)
        if action=='mine':
            bone(root,tip+Vector((-.17,0,0)),tip+Vector((.17,0,-.035)),.025,'metal',.014)
        elif action=='chop':
            sphere(root,'axe blade',tip+Vector((.045,-.025,0)),(.13,.031,.075),'metal')
        else:
            bone(root,tip+Vector((-.08,0,0)),tip+Vector((.08,0,0)),.055,'metal',.055)

for team, color in [('blue',(.15,.34,.52)),('red',(.54,.17,.10))]:
    M['team'].diffuse_color=(*color,1)
    atlas=Image.new('RGBA',(TILE*8,TILE*8*len(ACTIONS)))
    for ai, action in enumerate(ACTIONS):
        for root in roots:
            for child in list(root.children):
                bpy.data.objects.remove(child,do_unlink=True)
            bpy.data.objects.remove(root,do_unlink=True)
        roots.clear()
        for frame in range(8):
            for direction in range(8):
                # Foot anchor is pixel (48,82) within each cell.
                offset=right*((direction-3.5)*span)+up*((3.5-frame)*span-(82-48)/96*span)
                person(action,frame,direction,offset)
        scene.render.filepath=str(OUT / '_render.png')
        bpy.ops.render.render(write_still=True)
        with Image.open(OUT / '_render.png') as im:
            atlas.paste(im,(0,ai*TILE*8))
        print(f'Completed {team} {action}',flush=True)
    atlas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(OUT / f'villager-{team}.png',optimize=True)
(OUT / '_render.png').unlink(missing_ok=True)
print('Villager atlases complete.',flush=True)
