const express = require('express')  //import thư viện express để chạy máy chủ
const mysql = require('mysql')  //import thư viện mysql để kết nối với mysql
const cors = require('cors')    //import thư viện cors-middleware
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()   //tạo app
const port = 3000   //máy chủ express lắng nghe từ cổng này,
// máy chủ sẽ được khởi động khi gọi phương thức listen

app.use(cors())
/* Khi một ứng dụng web (client) cố gắng gửi yêu cầu đến một máy chủ từ một nguồn khác (domain, 
port hoặc protocol khác), trình duyệt sẽ chặn yêu cầu này trừ khi máy chủ cho phép nó.
Middleware cors() cho phép máy chủ chấp nhận các yêu cầu từ các nguồn khác nhau,
 giúp dễ dàng phát triển các ứng dụng web mà cần giao tiếp giữa các nguồn khác nhau 
 (ví dụ: frontend và backend nằm trên các domain khác nhau). */


app.use(express.json()) //parse nội dung json trong body của http request thành js object


//Thiết lập kết nối
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'wordle'
})


//Kết nối
db.connect(err => {
    if (err) {
        console.console.error('Cannot connect to mysql: ', err)
        return
    }
    console.log('Connected successfully.')
})


//server xử lý khi client gửi yêu cầu get tới url http://localhost:3000/wordle
app.get('/wordle', (req, res) => {
    db.query('select* from words', (error, result) => {
        if (error) {
            return res.status(500).send(err)
        }
        return res.json(result)
    })
})

//lấy word theo id (id=ngày hiện tại=kết quả của hàm getday)
app.get('/wordle/:id', (req, res) => {     //:id tham số động
    const id = req.params.id
    db.query('select* from words where id= ?', [id], (err, result) => {
        if (err) {
            return res.status(500).send(err)
        }
        return res.json(result)
    })
})

//post
app.post('/wordle', (req, res) => {
    var wId = req.body.id
    var w = req.body.ltr
    console.log(w)
    // console.log(w)
    db.query('insert into words values(?,?)', [wId, w], (err, result) => {
        if (err) {
            return res.status(500).send(err)
        }
        return res.json({
            message: "Insert new word successfully!",
            word: {
                id: wId,
                ltr: w
            }
        })
    })
})

//put
app.put('/wordle/:id', (req, res) => {
    var wId = req.params.id
    var w = req.body.ltr
    console.log(w)
    db.query('update words set ltr=? where id=?', [w, wId], (err, result) => {
        if (err) {
            return res.status(500).send(err)
        }
        return res.json({
            message: "Updated word successfully!",
            word: {
                id: wId,
                ltr: w
            }
        })
    })
})


//-------------------USER AUTHENTICATION-------------------------

app.post('/register', (req, res) => {
    const { username, password } = req.body
    try {
        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) {
                console.log(err)
                return res.status(500)
            }
            db.query('select* from user where username=?', [username], (error, result) => {
                if (error) {
                    return res.status(500).json({ message: 'Unexpected error happended. Please try again later.' })
                }
                if (result.length !== 0) return res.status(409).json({ message: 'Username is already exist.' })
                db.query('insert into user(username, password) values (?,?)', [username, hashedPassword], (error, result) => {
                    if (error) {
                        return res.status(500).json({ message: 'An error happens while storing user inf.' })
                    }
                    return res.status(201).json({ message: 'Done! Now you can login!' })
                })
            })

        })
    } catch (error) {
        return res.status(500).json({ message: 'Server error.' })
    }
})

app.post('/login', (req, res) => {
    const { username, password } = req.body
    db.query('select* from user where username=?', [username], (error, result) => {
        if (error) {
            throw error
        }
        if (result.length === 0) {
            return res.status(401).json({ message: "Invalid username." })
        }
        const user = result[0]

        bcrypt.compare(password, user.password, (err, same) => {
            if (err) throw err
            if (!same) return res.status(401).json({ message: "Wrong password." })
            const token = jwt.sign({ id: user.id, username: user.username }, 'secret_key')
            res.json({ token, message: 'Logged in!' })
        })
    })
})



//---------------------------------USER PROGRESS-------------------------------------------
const verify = (req, res, next) => {
    const token = req.headers['authorization']
    console.log(token)
    if (!token) {
        return res.status(500).send('Token not included in request.')
    }
    jwt.verify(token.split(' ')[1], 'secret_key', (error, decodeded) => {
        if (error) {
            console.log(error)
            return
        }
        console.log('ok')
        console.log(decodeded)
        next()
    })
}

app.post('/progress', verify, (req, res) => {
    const progress = req.body.progress
    //lấy userid = userId
    const userId = req.body.user_id
    //tìm user trong bảng user_progress
    //nếu có thì thực hiện query update table
    //nếu không thì insert với user_id và dữ liệu progress
    db.query('select* from user_progress where user_id=?', [userId], (error, result) => {
        if (error) throw error
        if (result.length === 0) {
            db.query('insert into user_progress values (?,?)', [userId, progress], (insert_error) => {
                if (insert_error) return res.status(500).send(insert_error)
                return res.status(201).json({
                    message: "Save progress successfully.",
                    progress: progress
                })
            })
        }
        else {
            db.query('update user_progress set progress=? where user_id=?', [progress, userId], (update_error) => {
                if (update_error) return res.status(500).send(update_error)
                return res.status(200).json({
                    message: "Save progress successfully.",
                    progress: progress
                })
            })
        }
    })
})

app.post('/getprogress', verify, (req, res) => {
    const userId = req.body.id
    console.log(userId)
    db.query('select* from user_progress where user_id=?', [userId], (error, result) => {
        if (error) return res.status(500).send('Error getting user progress')
        // console.log('result: ',result)
        // console.log('result: ',res.json(result))
        // if (result.length === 0) return res.json({

        // })
        return res.json(result)
    })
})
//--------------------------------------------
// Bắt đầu máy chủ
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});



//--------------------for feeding---------------------
app.post('/feed', (req, res) => {
    const progress = req.body.progress
    //lấy userid = userId
    const userId = req.body.user_id
    db.query('select* from user_progress where user_id=?', [userId], (error, result) => {
        if (error) throw error 
        if (result.length === 0) {
            db.query('insert into user_progress values (?,?)', [userId, progress], (insert_error) => {
                if (insert_error) return res.status(500).send(insert_error)
                return res.status(201).json({
                    message: "Save progress successfully.",
                    progress: progress
                })
            })
        }
        else {
            db.query('update user_progress set progress=? where user_id=?', [progress, userId], (update_error) => {
                if (update_error) return res.status(500).send(update_error)
                return res.status(200).json({
                    message: "Save progress successfully.",
                    progress: progress
                })
            })
        }
    })
})