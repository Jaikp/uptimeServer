import { PrismaClient } from '@prisma/client'
import { createClient } from 'redis';

const client = createClient();

client.on('error', err => console.log('Redis Client Error', err));

(async () => {
    await client.connect();
})();

const prisma = new PrismaClient()

const CheckUrlStatus = async (url : string)=>{
    try {
        const res = await fetch(url);
        if(res.status == 200){
            return "UP"
        }
        return "DOWN"           
    } catch (error) {
        return "DOWN"
    }
}

const Monitor = async ()=>{

    try {
        const monitors = await prisma.monitor.findMany();
        for(const monitor of monitors){
            const res = await CheckUrlStatus(monitor.url);
            const status = await prisma.monitor.findUnique({
                where : {
                    url : monitor.url
                }
            })
            if(res === 'UP' && status?.status === 'DOWN'){
                const website = await prisma.monitor.update({
                    where : {
                        id : monitor.id
                    },
                    data :{
                        status : "UP"
                    }
                })
            }
            if(res === 'DOWN'){
                const lastAlert = await prisma.alert.findFirst({
                    where : {
                        monitorId: monitor.id,
                        userId: monitor.userId,
                        type: 'EMAIL'
                    },
                    orderBy : {
                        sentAt: 'desc'
                    }

                })
                
                const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000); 
                if(!lastAlert || lastAlert.sentAt < oneHourAgo){
                    const website = await prisma.monitor.update({
                        where : {
                            id : monitor.id
                        },
                        data :{
                            status : "DOWN"
                        }
                    })
                    const user = await prisma.user.findUnique({
                        where : {
                            id : monitor.userId
                        }
                    })

                    await client.lPush('email',JSON.stringify({email : user?.email,website : website.url}));

                    await prisma.alert.create({
                        data : {
                            type : 'EMAIL',
                            monitorId : monitor.id,
                            userId : monitor.userId
                        }
                    })
                }
            }
        }
        
    } catch (error) {
        console.log(error);
    }
}
function hello ( ){
    Monitor();
}

setInterval(hello,10000);

export default client;

