import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface Env {
  FILEBASE_KEY: string;
  FILEBASE_SECRET: string;
  FILEBASE_BUCKET: string;
  GATEWAY_TOKEN: string;
  APP_ORIGIN: string;
}
const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg","image/png","image/webp","image/heic","video/mp4","video/quicktime","video/webm"]);
function json(data: unknown, status=200, origin="") {
  return new Response(JSON.stringify(data), {status,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":origin,"Vary":"Origin"}});
}
function clean(value:string) { return value.replace(/[^a-zA-Z0-9_-]/g,"").slice(0,100); }
export default {
 async fetch(request:Request, env:Env):Promise<Response>{
  const origin=request.headers.get("Origin")||"";
  if(origin && origin!==env.APP_ORIGIN) return new Response("Origin denied",{status:403});
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":env.APP_ORIGIN,"Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization","Access-Control-Max-Age":"86400","Vary":"Origin"});
  if(!env.GATEWAY_TOKEN || request.headers.get("Authorization")!==`Bearer ${env.GATEWAY_TOKEN}`) return json({error:"Unauthorized"},401,env.APP_ORIGIN);
  const s3=new S3Client({endpoint:"https://s3.filebase.io",region:"auto",credentials:{accessKeyId:env.FILEBASE_KEY,secretAccessKey:env.FILEBASE_SECRET}});
  const url=new URL(request.url);
  if(url.pathname==="/api/media/upload-url" && request.method==="POST"){
   let body:any; try{body=await request.json();}catch{return json({error:"Invalid JSON"},400,env.APP_ORIGIN);}
   const mime=String(body.mimeType||""); const size=Number(body.size||0);
   const outing=clean(String(body.outingId||"")); const media=clean(String(body.mediaId||""));
   if(!outing||!media||!ALLOWED_TYPES.has(mime)||size<=0||size>MAX_BYTES) return json({error:"Invalid file metadata"},400,env.APP_ORIGIN);
   const key=`outings/${outing}/media/${media}`;
   const signed=await getSignedUrl(s3,new PutObjectCommand({Bucket:env.FILEBASE_BUCKET,Key:key,ContentType:mime}),{expiresIn:600});
   return json({url:signed,method:"PUT",headers:{"Content-Type":mime},objectKey:key},200,env.APP_ORIGIN);
  }
  if(url.pathname==="/api/media/download-url" && request.method==="GET"){
   const key=url.searchParams.get("objectKey")||"";
   if(!/^outings\/[a-zA-Z0-9_-]{1,100}\/media\/[a-zA-Z0-9_-]{1,100}$/.test(key)) return json({error:"Invalid object key"},400,env.APP_ORIGIN);
   const signed=await getSignedUrl(s3,new GetObjectCommand({Bucket:env.FILEBASE_BUCKET,Key:key}),{expiresIn:600});
   return json({url:signed},200,env.APP_ORIGIN);
  }
  return json({error:"Not found"},404,env.APP_ORIGIN);
 }
};
