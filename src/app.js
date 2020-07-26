let express = require('express');
let app = express();
const fs = require('fs');
const { spawn } = require("child_process");
var request = require('request');




let servers = JSON.parse(fs.readFileSync('servers.json'));
let config = JSON.parse(fs.readFileSync('config.json'));

const deb =config.debug;

let activated = [];



function backupall(){
  servers.forEach(server => {
    let starttime = Date.now();
    let filter = false;

    activated[server.backupname.toString()] = 
    {
      "starttime" :starttime,
      "transfered": [],
      "endtime": 0
    }



    if (!fs.existsSync(config.backup_location + "/" + server.server)){
      fs.mkdirSync(config.backup_location + "/" + server.server);
    }

    let logfile = config.backup_location + "/" + server.server + "/" +server.backupname+".txt";
    var stream = fs.createWriteStream(logfile);
    stream.once('open', function(fd) {



      if(deb) console.log("Server start Backup:" + server.backupname);
      
      let login = "ftp://"+server.FTPuser+":"+server.FTPpass+"@"+server.server+ "/" +server.FTP_dir + "/*";
      
      let ls = spawn("wget", ["-m", "--no-cache","-P",config.backup_location + server.local_dir, login ]);

      ls.stdout.on("data", data => {

          console.log(server.backupname + `stdout: ${data}`);
        /*
        if(data.includes(config.ftp_endword)){
          filter = true;
        }
        if(filter){
          activated[server.backupname].transfered.push(data);
        }
        */
          stream.write(data);
      });

      ls.stderr.on("data", data => {
          if(deb) console.log(server.backupname + `stderr: ${data}`);
          /*
          if(data.includes(config.ftp_endword)){
            filter = true;
          }
          if(filter){
            activated[server.backupname].transfered.push(data);
          }
          */
          stream.write(data);
      });

      ls.on('error', (error) => {
          if(deb) console.log(server.backupname + `error: ${error.message}`);
          stream.write(data);
      });

      ls.on("close", code => {
          if(deb) console.log(server.backupname +  `child process exited with code ${code}`);
          stream.write(server.backupname +  `child process exited with code ${code}`);
          stream.end();
          
//          zipfile(server,logfile);
          bu_database(server,logfile);
      });
    });
  });
}

function bu_database(server, logfile){
  let ts = Date.now();
  if(server.db_backup){


    request.post(
          server.db_budir,
          {
              form: {
                  db_bukey: server.db_bukey
              }
          }
      )
      .on('error', function(err) {
          // error handling
      })
      .on('finish', function(err) {
          // request is finished
          console.log("Database taken:" + server.backupname );
      })
      .pipe(fs.createWriteStream(config.backup_location+"/"+server.server + "/"+ server.backupname + "_database_" +ts+ ".sql.gz")
      .on('close', function(){
        zipfile(server, logfile, ts);
      } ));
  }else{
    zipfile(server, logfile, ts);
  }

}

function zipfile(server, logfile , time){

  let ts = time;

  let date_ob = new Date(ts);
  
  let location = config.backup_location + "/" +server.backupname + "_" + ts + ".tar.bz2";
  let files = config.backup_location + server.local_dir + "/" + server.server ;
  let db_file = "";
  let lname = server.backupname+".txt";
  let sdir = config.backup_location + "/" + server.server;

  let tar_commands =[
    "-czvf",
    location,
    "-C", 
    files, 
    server.FTP_dir, 
    "-C" , 
    sdir, 
    lname
  ]

  if(server.db_backup){
    tar_commands.push("-C");
    tar_commands.push(sdir);
    tar_commands.push( server.backupname + "_database_" +ts+ ".sql.gz");
    
  }


  //console.log("Location:" + location);
  //console.log("files"+files);
  
  //copy Logfile into the dir
 // fs.copyFile(logfile, files + "/" + server.FTP_dir + "/" +server.backupname + "_"+ ts +".txt", (err) => {
    
  if(deb) console.log("TAR Befehle: "+tar_commands);
  let zip = spawn("tar", tar_commands);

      zip.stdout.on("data", data => {
          console.log(server.backupname + `Zip Out - : ${data}`);
        // stream.write(data);
      });

      zip.stderr.on("data", data => {
          if(deb) console.log(server.backupname + `Zip Err - : ${data}`);
        // stream.write(data);
      });

      zip.on('error', (error) => {
          if(deb) console.log(server.backupname + `Errorzip - : ${error.message}`);
        // stream.write(data);
      });

      zip.on("close", code => {
          if(deb) console.log(server.backupname +  `ZIP exited with code ${code}`);
          
          activated[server.backupname].endtime=Date.now();
          
          console.log(activated[server.backupname]);
        
        // stream.write(server.backupname +  `child process exited with code ${code}`);
        // stream.end();
        // zipfile(server);
      });
     
    //});
  }

app.get('/', function (req, res) {
  res.send('Hello World!');
});
app.get('/start', function (req, res) {
  backupall();
  res.send('start Backup');
});
app.get('/active', function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(activated, null, 3));

  console.log(activated);
});

app.listen(3030, function () {
  console.log('Listening on port 3030!');
});
