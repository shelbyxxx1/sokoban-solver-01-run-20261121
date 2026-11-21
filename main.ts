import{readdirSync as ls,readFileSync as read,mkdirSync as mkdir,writeFileSync as write}from'node:fs'
import{join}from'node:path'
let w,h,f,n,g,l,m,q,t,v,e,N
const O=a=>a.sort((a,b)=>a-b),U=a=>new Set(a),A=()=>new Int32Array(N)
function R(p,b,W=false){
let a=0,z=1,k=p
++t
m[p]=t
q[0]=p
while(a<z){
let c=q[a++]
k=Math.min(k,c)
for(let d=0;d<4;d++){
let x=n[d][c]
if(x<0||!f[x]||b.has(x)||m[x]==t)continue
m[x]=t
q[z++]=x
if(W){
v[x]=c
e[x]=d
}
}
}
return k
}
function D(c,b,s){
let x=c%w,y=c/w|0
for(let oy of[y-1,y])for(let ox of[x-1,x]){
let ok=1,bad=0
for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
let j=(oy+dy)*w+ox+dx
if(f[j]&&!b.has(j)&&!s.has(j))ok=0
if(b.has(j)&&!g.includes(j))bad=1
}
if(ok&&bad)return true
}
return false
}
function B(b,go,p,s,z){
let C=[[O(b.slice()),p,-1]],K=U([R(p,U([...s,...z,...b]))+':'+C[0][0]]),F=b.every(c=>go.includes(c))?0:-1
for(let H=0;F<0&&H<C.length;H++){
let [X,P]=C[H],Z=U([...s,...z,...X]),E=[]
R(P,Z)
for(let c of X)for(let d=0;d<4;d++){
let x=n[d][c],a=n[d^1][c]
if(x>=0&&a>=0&&m[a]==t&&f[x]&&l[x]&&!Z.has(x))E.push([c,d,x])
}
for(let[c,d,x]of E){
let Y=O(X.map(a=>a==c?x:a)),V=U([...s,...Y])
if(D(x,V,z))continue
let k=R(c,U([...V,...z]))+':'+Y
if(K.has(k))continue
if(C.length>=250000)throw Error('250000-state cap')
K.add(k)
C.push([Y,c,H,c,d])
if(Y.every(a=>go.includes(a))){
F=C.length-1
break
}
}
}
if(F<0)throw Error('Search exhausted')
let Q=[]
for(let j=F;C[j][2]>=0;j=C[j][2])Q.push(C[j].slice(3))
return Q.reverse()
}
function S(T){
let r=T.replace(/\r/g,'').split('\n'),b=[],p=-1
while(r.at(-1)=='')r.pop()
if(!r.length)throw Error('No r')
h=r.length
w=Math.max(...r.map(a=>a.length))
N=w*h
f=new Uint8Array(N)
g=[]
for(let y=0;y<h;y++)for(let x=0;x<r[y].length;x++){
let c=y*w+x,a=r[y][x]
if(a=='#')continue
f[c]=1
if('.*+'.includes(a))g.push(c)
if('$*'.includes(a))b.push(c)
if('@+'.includes(a))p=c
}
for(let c=0;c<N;c++)if(c<w||c>=w*(h-1)||c%w==0||c%w==w-1)f[c]=0
if(p<0||b.length!=g.length)throw Error('Invalid level')
O(b)
O(g)
n=[-w,w,-1,1].map((a,d)=>Int32Array.from(f,(_,c)=>c+a<0||c+a>=N||d==2&&c%w==0||d==3&&c%w==w-1?-1:c+a))
l=new Uint8Array(N)
let q0=[...g]
for(let c of g)l[c]=1
for(let j=0;j<q0.length;j++)for(let d=0;d<4;d++){
let c=n[d][q0[j]],a=c<0?-1:n[d][c]
if(c<0||!f[c]||l[c]||a<0||!f[a])continue
l[c]=1
q0.push(c)
}
let cut=f.map((a,c)=>a&&!l[c]&&(c/w|0)==(p/w|0)),v0=U([]),r0=[]
for(let c=0;c<N;c++){
if(!f[c]||cut[c]||v0.has(c))continue
q0=[c]
v0.add(c)
for(let j=0;j<q0.length;j++)for(let d=0;d<4;d++){
let a=n[d][q0[j]]
if(a<0||!f[a]||cut[a]||v0.has(a))continue
v0.add(a)
q0.push(a)
}
let cs=U(q0),b0=b.filter(a=>cs.has(a)),g0=g.filter(a=>cs.has(a))
if(b0.length!=g0.length){
r0=null
break
}
if(b0.length)r0.push([b0,g0])
}
if(b.some(c=>cut[c])||r0==null)r0=[[b,g]]
m=A()
q=A()
v=A()
e=A()
t=0
let M=U(b),z=U([]),o=''
for(let[X,G]of r0){
let s=U([...M].filter(c=>!X.includes(c)))
for(let c of X)M.delete(c)
for(let[c,d]of B(X,G,p,s,z)){
let a0=n[d^1][c],W=''
R(p,U([...s,...z,...X]),true)
if(m[a0]!=t)throw Error('Unreachable push')
for(let a=a0;a!=p;a=v[a])W='udlr'[e[a]]+W
o+=W+'UDLR'[d]
let j=X.indexOf(c)
if(j<0)throw Error('Invalid push')
X=O(X.map(a=>a==c?n[d][c]:a))
p=c
}
for(let c of G)z.add(c)
}
return o
}
const I=process.env.MAKEFUN_INPUT_DIR??'/input',J=process.env.MAKEFUN_OUTPUT_DIR??'/output'
for(let id of ls(I).sort()){
let E=S(read(join(I,id,'level.txt'),'utf8')),dir=join(J,id)
if(Buffer.byteLength(E)+1>65536)throw Error('65536-byte limit')
mkdir(dir,{recursive:true})
write(join(dir,'solution.txt'),E+'\n','utf8')
}
