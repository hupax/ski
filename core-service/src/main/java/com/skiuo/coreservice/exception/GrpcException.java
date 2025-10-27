package com.skiuo.coreservice.exception;

public class GrpcException extends RuntimeException {

    public GrpcException(String message) {
        super(message);
    }

    public GrpcException(String message, Throwable cause) {
        super(message, cause);
    }
}
