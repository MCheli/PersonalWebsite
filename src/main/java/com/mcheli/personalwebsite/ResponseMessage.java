package com.mcheli.personalwebsite;

public class ResponseMessage {

    private String msg;
    private String error;

    public ResponseMessage(String msg, String error) {
        this.msg = msg;
        this.error = error;
    }

    public String getMsg() {
        return msg;
    }

    public void setMsg(String msg) {
        this.msg = msg;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }
}
