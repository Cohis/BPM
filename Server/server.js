const express = require('express')
const app = express()
const fs = require('fs')
const path = require('path')



app.get('/songs', (req, res) => {

    const songpath = path.join(__dirname, 'songs');

    res.json(fs.readdirSync(songpath));

})


app.get('/songs/:file', (req, res) => {
    
    //pegar a música com path.join
    //verificar se ela existe e fazer o stream

    const song = path.join(__dirname, '/songs/' + req.params.file);
    console.log(req.params);

    if(fs.existsSync(song)){

        //Está entrando no if corretamente

        const stream = fs.createReadStream(song);

        //setamos um Header para que o navegador saiba qual ação tomar

        res.setHeader('Content-Type','audio/mp3');

        stream.pipe(res)

        console.log("DEBUG:", song);
    }

    else{

        console.log("Song not found :(")
    }

})


app.listen(8080, () => {
    console.log('Server is running at port 8080')
})