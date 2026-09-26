import { Link } from 'react-router-dom'

const NotFound = () => {
    return <>
        <div className="w-screen h-screen flex justify-center place-items-center">
            <div className="flex gap-2">
                404
                <Link to="/" className=" text-muted-foreground" >Back to home</Link>
            </div>
        </div>
    </>
}

export default NotFound