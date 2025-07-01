export const formatResponse = (response, status, code, data = {}, description = "") => {
    return response.status(status).json({
        code,
        msg: description,
        data,
    });
}
