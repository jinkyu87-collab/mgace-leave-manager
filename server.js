require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'mgace-leave-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }, // 8시간
}));

app.use((req, res, next) => {
  res.locals.currentEmployee = req.session.employee || null;
  next();
});

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/leave'));
app.use('/admin', require('./routes/admin'));
app.use('/admin/promotion', require('./routes/promotion'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`연차관리 시스템 실행중: http://localhost:${PORT}`));
