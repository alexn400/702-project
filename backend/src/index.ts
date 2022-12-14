import dotenv from 'dotenv'
dotenv.config()

import express, { NextFunction, Request, Response } from 'express'
import path from 'path'
import * as OpenApiValidator from 'express-openapi-validator'
import { ValidationError } from 'express-openapi-validator/dist/framework/types'
import Logger from './util/logger'
import expressWinston from 'express-winston'
import cors from 'cors'

const app = express()

app.use(cors())

app.use(express.json())
app.use(express.text())
app.use(express.urlencoded({ extended: true }))

app.use(
    expressWinston.logger({
        winstonInstance: Logger.getLogger('express'),
        msg: '{{req.hostname}} - - - "{{req.method}} {{req.url}} HTTP{{req.httpVersion}}" {{res.statusCode}} -',
        colorize: true
    })
)

// app.get('/', (req, res) => {
//     return res.status(200).json({
//         apiVersion: 1.0
//     })
// })

app.use(
    OpenApiValidator.middleware({
        apiSpec: './spec.yaml',
        validateRequests: true,
        validateResponses: true
    })
)

import { getReflections, createReflection } from './controllers/reflections'
app.get('/reflections', getReflections)
app.post('/reflections', createReflection)

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (!(err.status && err.errors)) {
        return next(err)
    }
    const verror = err as ValidationError
    if (res.headersSent) {
        return next(verror)
    }
    Logger.getLogger('validation').warn(
        `${verror.errors[0].path} ${verror.errors[0].message}`
    )
    return res.status(verror.status).json({
        error: verror
    })
})

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
        return next(err)
    }
    Logger.getLogger('controller').error(`${err.stack}`)

    const displayError =
        process.env.NODE_ENV === 'production'
            ? 'An unexpected error has occurred. Please try again later.'
            : err.stack
    return res.status(500).json({
        error: displayError
    })
})

if (!process.env.PORT) {
    Logger.getLogger('express').error('Environment variable "PORT" not found')
    process.exit(1)
}

if (!process.env.DB_URL) {
    Logger.getLogger('express').error('Environment variable "DB_URL" not found')
    process.exit(1)
}

app.listen(process.env.PORT, () => {
    Logger.getLogger('express').info(
        `Server started at port ${process.env.PORT}`
    )
})

const signals = [
    'SIGHUP',
    'SIGINT',
    'SIGQUIT',
    'SIGILL',
    'SIGTRAP',
    'SIGABRT',
    'SIGBUS',
    'SIGFPE',
    'SIGUSR1',
    'SIGSEGV',
    'SIGUSR2',
    'SIGTERM'
]
signals.forEach((signal) => {
    process.on(signal, () => {
        Logger.getLogger('general').info(
            `Received ${signal}, closing server...`
        )
        process.exit(1)
    })
})
